import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncAllCachedDeals, syncCachedDealsForAppId } from '../dealMetadataSync'
import { isMetadataIncomplete } from '../isMetadataIncomplete'
import { describeMetadata } from '../describeMetadata'

export interface ResolveMissingMetadataResult {
  resolved: number
  failed: number
  synced: number
}

/** 'all' = wishlist + biblioteca (padrão, botão em Configurações). 'library' = só biblioteca (botão de sincronizar em Minha Biblioteca e o ciclo automático de ofertas). */
export type ResolveMissingMetadataScope = 'all' | 'library'

/**
 * Resolve capa/gênero/sinopse/trailer da Steam pra quem ainda não tem isso em
 * cache. Por padrão (`scope: 'all'`) cobre wishlist + biblioteca, sem
 * duplicar quem está nas duas listas — é o que roda pelo botão em
 * Configurações. Com `scope: 'library'`, só considera jogos possuídos — tanto
 * o botão "Sincronizar com a Steam" da tela Minha Biblioteca (na hora, depois
 * de atualizar a lista) quanto o ciclo automático de busca de ofertas (a cada
 * `polling.intervalMinutes`, junto com o backfill de wishlist que o
 * `FetchOwnableDeals` já faz sozinho) disparam isso, pra manter a metadata da
 * biblioteca completa sem precisar do botão manual.
 *
 * Sincroniza o cache de ofertas (Dashboard e Wishlist) a cada jogo resolvido
 * — não só no final — pra quem estiver de olho na tela ver o progresso
 * conforme roda, já que essa operação pode levar bastante tempo (1,5s por
 * jogo, respeitando o rate limit da Steam).
 */
export class ResolveMissingMetadata {
  private inFlight: Promise<ResolveMissingMetadataResult> | null = null
  private cancelled = false

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  execute(scope: ResolveMissingMetadataScope = 'all'): Promise<ResolveMissingMetadataResult> {
    if (this.inFlight) return this.inFlight
    this.cancelled = false
    this.inFlight = this.run(scope).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /** Para a resolução em andamento assim que possível — termina o jogo atual, mas não começa o próximo. */
  cancel(): void {
    this.cancelled = true
  }

  isResolving(): boolean {
    return this.inFlight !== null
  }

  private async run(scope: ResolveMissingMetadataScope): Promise<ResolveMissingMetadataResult> {
    const targetsByAppId = new Map<number, { appId: number; title: string }>()
    if (scope === 'all') {
      for (const item of this.cacheRepository.getWishlist()) {
        targetsByAppId.set(item.appId, { appId: item.appId, title: item.title })
      }
    }
    for (const game of this.cacheRepository.getOwnedGames()) {
      targetsByAppId.set(game.appId, { appId: game.appId, title: game.name })
    }
    const missing = [...targetsByAppId.values()].filter((item) =>
      isMetadataIncomplete(this.cacheRepository.getMetadata(item.appId))
    )

    const scopeLabel = scope === 'library' ? 'biblioteca' : 'wishlist + biblioteca'
    this.sessionLogRepository.log(
      'info',
      `Resolvendo metadata da Steam (${scopeLabel}): ${missing.length} jogo(s) sem metadata completa em cache.`
    )

    let resolved = 0
    let failed = 0
    let synced = 0

    let processed = 0
    for (const item of missing) {
      if (this.cancelled) break

      this.sessionLogRepository.log('info', `Buscando metadata da Steam pra "${item.title}"...`)
      const metadata = await this.metadataRepository.fetchMetadata(item.appId)
      processed += 1
      if (metadata) {
        this.cacheRepository.setMetadata(metadata)
        resolved += 1
        synced += syncCachedDealsForAppId(this.cacheRepository, item.appId, metadata)
        this.sessionLogRepository.log(
          'success',
          `Metadata resolvida pra "${item.title}": ${describeMetadata(metadata)}.`
        )
      } else {
        failed += 1
        this.sessionLogRepository.log('warn', `Não consegui metadata da Steam pra "${item.title}".`)
      }
    }

    // Rede de segurança: cobre metadata que já estava completa em cache antes
    // desta execução (então nunca passou pelo loop acima) mas nunca tinha
    // sido aplicada nas ofertas cacheadas.
    synced += syncAllCachedDeals(this.cacheRepository)

    if (this.cancelled) {
      this.sessionLogRepository.log(
        'warn',
        `Resolução de metadata cancelada: ${processed}/${missing.length} jogo(s) processado(s) (${resolved} resolvido(s), ${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s) com a metadata.`
      )
      return { resolved, failed, synced }
    }

    this.sessionLogRepository.log(
      'success',
      `Metadata resolvida: ${resolved}/${missing.length} jogo(s) (${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s) com a metadata.`
    )
    return { resolved, failed, synced }
  }
}
