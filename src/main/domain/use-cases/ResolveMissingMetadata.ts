import type { GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncAllCachedDeals, syncCachedDealsForAppId } from '../dealMetadataSync'

/** Todo campo de GameMetadata exceto o id — usado só pra detectar cache incompleto (ver isMetadataIncomplete). */
const METADATA_FIELDS: Array<keyof GameMetadata> = [
  'title',
  'genres',
  'headerImageUrl',
  'steamPrice',
  'steamDiscountPercent',
  'steamFullPrice',
  'shortDescription',
  'developers',
  'publishers',
  'releaseDate',
  'metacriticScore',
  'recommendationsTotal',
  'screenshots',
  'trailerUrl'
]

export interface ResolveMissingMetadataResult {
  resolved: number
  failed: number
  synced: number
}

/** 'all' = wishlist + biblioteca (padrão, botão em Configurações). 'library' = só biblioteca (botão de sincronizar em Minha Biblioteca). */
export type ResolveMissingMetadataScope = 'all' | 'library'

/**
 * Ação manual e independente da busca de ofertas: resolve capa/gênero/sinopse/
 * trailer da Steam pra quem ainda não tem isso em cache. Por padrão (`scope:
 * 'all'`) cobre wishlist + biblioteca, sem duplicar quem está nas duas listas
 * — é o que roda pelo botão em Configurações. Com `scope: 'library'`, só
 * considera jogos possuídos — é o que o botão "Sincronizar com a Steam" da
 * tela Minha Biblioteca dispara automaticamente depois de atualizar a lista,
 * pra não depender do botão genérico só pra ver a capa dos próprios jogos.
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
    const missing = [...targetsByAppId.values()].filter((item) => this.isMetadataIncomplete(item.appId))

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
        this.sessionLogRepository.log('success', `Metadata resolvida pra "${item.title}".`)
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

  /**
   * Considera "incompleta" tanto a ausência total de metadata quanto uma
   * metadata cacheada por uma versão anterior de GameMetadata — checa contra
   * TODOS os campos atuais (METADATA_FIELDS), não um campo específico, então
   * um campo novo adicionado no futuro já é pego automaticamente, sem
   * precisar lembrar de atualizar essa checagem de novo.
   */
  private isMetadataIncomplete(appId: number): boolean {
    const metadata = this.cacheRepository.getMetadata(appId)
    if (!metadata) return true
    return METADATA_FIELDS.some((field) => metadata[field] === undefined)
  }
}
