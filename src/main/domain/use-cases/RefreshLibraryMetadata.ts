import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncAllCachedDeals, syncCachedDealsForAppId } from '../dealMetadataSync'

export interface RefreshLibraryMetadataResult {
  refreshed: number
  failed: number
  synced: number
}

/**
 * Diferente de ResolveMissingMetadata (que só preenche o que falta), essa reconfere a metadata de TODOS
 * os jogos da biblioteca — mesmo quem já tem tudo em cache — pra pegar mudanças que a Steam faz depois
 * de resolvida uma vez (capa nova, sinopse editada, gênero atualizado, nota do Metacritic mudou etc.).
 * Roda sozinha a cada 24h (ver LastRunScheduler em main/index.ts), sem botão manual.
 *
 * Retomável: `getPendingLibraryRefreshAppIds`/`setPendingLibraryRefreshAppIds` guardam quem ainda falta
 * reconferir no ciclo atual — se o app fechar no meio de uma reconferência grande, a próxima execução
 * continua de onde parou em vez de recomeçar do primeiro jogo. Isso só vale dentro do mesmo ciclo
 * interrompido: assim que os pendentes zeram (ciclo completo), a próxima chamada (24h depois) já é um
 * ciclo novo, reconferindo todo mundo de novo.
 */
export class RefreshLibraryMetadata {
  private inFlight: Promise<RefreshLibraryMetadataResult> | null = null
  private cancelled = false

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  execute(): Promise<RefreshLibraryMetadataResult> {
    if (this.inFlight) return this.inFlight
    this.cancelled = false
    this.inFlight = this.run().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /** Para a reconferência em andamento assim que possível — termina o jogo atual, mas não começa o próximo. */
  cancel(): void {
    this.cancelled = true
  }

  isRefreshing(): boolean {
    return this.inFlight !== null
  }

  private async run(): Promise<RefreshLibraryMetadataResult> {
    const ownedGames = this.cacheRepository.getOwnedGames()
    const candidateAppIds = new Set(ownedGames.map((game) => game.appId))
    const titleByAppId = new Map(ownedGames.map((game) => [game.appId, game.name]))

    const filteredPending = this.cacheRepository
      .getPendingLibraryRefreshAppIds()
      .filter((appId) => candidateAppIds.has(appId))
    const isResuming = filteredPending.length > 0
    const toProcess = isResuming ? filteredPending : [...candidateAppIds]
    this.cacheRepository.setPendingLibraryRefreshAppIds(toProcess)

    this.sessionLogRepository.log(
      'info',
      isResuming
        ? `Retomando reconferência de metadata da biblioteca: ${toProcess.length}/${ownedGames.length} jogo(s) ainda faltam.`
        : `Reconferindo metadata da Steam pra toda a biblioteca: ${toProcess.length} jogo(s).`
    )

    let refreshed = 0
    let failed = 0
    let synced = 0
    let processed = 0

    const pending = new Set(toProcess)
    for (const appId of toProcess) {
      if (this.cancelled) break

      const title = titleByAppId.get(appId) ?? `AppID ${appId}`
      const metadata = await this.metadataRepository.fetchMetadata(appId)
      processed += 1
      if (metadata) {
        this.cacheRepository.setMetadata(metadata)
        refreshed += 1
        synced += syncCachedDealsForAppId(this.cacheRepository, appId, metadata, true)
      } else {
        failed += 1
        this.sessionLogRepository.log('warn', `Não consegui reconferir metadata da Steam pra "${title}".`)
      }
      pending.delete(appId)
      this.cacheRepository.setPendingLibraryRefreshAppIds([...pending])
    }

    synced += syncAllCachedDeals(this.cacheRepository, true)

    if (this.cancelled) {
      this.sessionLogRepository.log(
        'warn',
        `Reconferência de metadata da biblioteca cancelada: ${processed}/${toProcess.length} jogo(s) processado(s) (${refreshed} atualizado(s), ${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s).`
      )
      return { refreshed, failed, synced }
    }

    this.sessionLogRepository.log(
      'success',
      `Reconferência de metadata da biblioteca concluída: ${refreshed}/${toProcess.length} jogo(s) (${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s).`
    )
    return { refreshed, failed, synced }
  }
}
