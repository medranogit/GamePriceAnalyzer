import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncAllCachedDeals, syncCachedDealsForAppId } from '../dealMetadataSync'
import { describeMetadata } from '../describeMetadata'

export interface RefreshLibraryMetadataResult {
  refreshed: number
  failed: number
  synced: number
}

/** 'all' = wishlist + biblioteca (botão "Sobrescrever tudo" em Configurações). 'library' = só biblioteca. */
export type RefreshMetadataScope = 'all' | 'library'

/**
 * Diferente de ResolveMissingMetadata (que só preenche o que falta), essa reconfere a metadata de TODOS
 * os alvos do escopo — mesmo quem já tem tudo em cache — pra pegar mudanças que a Steam faz depois
 * de resolvida uma vez (capa nova, sinopse editada, gênero atualizado, nota do Metacritic mudou etc.).
 * Sem scheduler automático — só roda quando disparada manualmente (botão "Sobrescrever tudo").
 *
 * Retomável: `getPendingLibraryRefreshAppIds`/`setPendingLibraryRefreshAppIds` guardam quem ainda falta
 * reconferir no ciclo atual — se o app fechar no meio de uma reconferência grande, a próxima execução
 * continua de onde parou em vez de recomeçar do primeiro jogo.
 */
export class RefreshLibraryMetadata {
  private inFlight: Promise<RefreshLibraryMetadataResult> | null = null
  private cancelled = false

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  execute(scope: RefreshMetadataScope = 'library'): Promise<RefreshLibraryMetadataResult> {
    if (this.inFlight) return this.inFlight
    this.cancelled = false
    this.inFlight = this.run(scope).finally(() => {
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

  private async run(scope: RefreshMetadataScope): Promise<RefreshLibraryMetadataResult> {
    const targetsByAppId = new Map<number, string>()
    if (scope === 'all') {
      for (const item of this.cacheRepository.getWishlist()) {
        targetsByAppId.set(item.appId, item.title)
      }
    }
    for (const game of this.cacheRepository.getOwnedGames()) {
      targetsByAppId.set(game.appId, game.name)
    }
    const candidateAppIds = new Set(targetsByAppId.keys())

    const filteredPending = this.cacheRepository
      .getPendingLibraryRefreshAppIds()
      .filter((appId) => candidateAppIds.has(appId))
    const isResuming = filteredPending.length > 0
    const toProcess = isResuming ? filteredPending : [...candidateAppIds]
    this.cacheRepository.setPendingLibraryRefreshAppIds(toProcess)

    const scopeLabel = scope === 'all' ? 'wishlist + biblioteca' : 'biblioteca'
    this.sessionLogRepository.log(
      'info',
      isResuming
        ? `Retomando reconferência de metadata (${scopeLabel}): ${toProcess.length}/${targetsByAppId.size} jogo(s) ainda faltam.`
        : `Reconferindo metadata da Steam (${scopeLabel}): ${toProcess.length} jogo(s).`
    )

    let refreshed = 0
    let failed = 0
    let synced = 0
    let processed = 0

    const pending = new Set(toProcess)
    for (const appId of toProcess) {
      if (this.cancelled) break

      const title = targetsByAppId.get(appId) ?? `AppID ${appId}`
      const metadata = await this.metadataRepository.fetchMetadata(appId)
      processed += 1
      if (metadata) {
        this.cacheRepository.setMetadata(metadata)
        refreshed += 1
        synced += syncCachedDealsForAppId(this.cacheRepository, appId, metadata, true)
        const message = `Metadata sobrescrita pra "${title}": ${describeMetadata(metadata)}.`
        this.sessionLogRepository.log('success', message)
        this.historyRepository.addEvent('metadata_refresh', message, appId)
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
        `Reconferência de metadata (${scopeLabel}) cancelada: ${processed}/${toProcess.length} jogo(s) processado(s) (${refreshed} atualizado(s), ${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s).`
      )
      return { refreshed, failed, synced }
    }

    this.sessionLogRepository.log(
      'success',
      `Reconferência de metadata (${scopeLabel}) concluída: ${refreshed}/${toProcess.length} jogo(s) (${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s).`
    )
    return { refreshed, failed, synced }
  }
}
