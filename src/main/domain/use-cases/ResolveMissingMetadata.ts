import type { GameDeal, GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

const STEAM_RATE_LIMIT_DELAY_MS = 1500

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Aplica a metadata da Steam em cima de uma oferta cacheada, sem sobrescrever o que já tinha valor.
 * `deal`/`metadata` podem ter sido salvos em disco por uma versão anterior do app, sem os campos mais
 * novos — daí o `?? []`/`?? null` em vez de acessar os campos direto (ver regressão de `steamFullPrice`
 * em dealPricing.ts).
 */
function applyMetadataToDeal(deal: GameDeal, metadata: GameMetadata): GameDeal {
  const dealDevelopers = deal.developers ?? []
  const dealPublishers = deal.publishers ?? []
  const dealScreenshots = deal.screenshots ?? []
  const metadataGenres = metadata.genres ?? []
  const metadataDevelopers = metadata.developers ?? []
  const metadataPublishers = metadata.publishers ?? []
  const metadataScreenshots = metadata.screenshots ?? []

  const nextCoverUrl = deal.coverUrl ?? metadata.headerImageUrl ?? undefined
  const nextGenres = metadataGenres.length > 0 ? metadataGenres : deal.genres
  const nextShortDescription = deal.shortDescription ?? metadata.shortDescription ?? null
  const nextDevelopers = dealDevelopers.length > 0 ? dealDevelopers : metadataDevelopers
  const nextPublishers = dealPublishers.length > 0 ? dealPublishers : metadataPublishers
  const nextReleaseDate = deal.releaseDate ?? metadata.releaseDate ?? null
  const nextMetacriticScore = deal.metacriticScore ?? metadata.metacriticScore ?? null
  const nextRecommendationsTotal = deal.recommendationsTotal ?? metadata.recommendationsTotal ?? null
  const nextScreenshots = dealScreenshots.length > 0 ? dealScreenshots : metadataScreenshots
  const nextTrailerUrl = deal.trailerUrl ?? metadata.trailerUrl ?? null
  const isUpToDate =
    nextCoverUrl === deal.coverUrl &&
    nextGenres === deal.genres &&
    nextShortDescription === deal.shortDescription &&
    nextDevelopers === deal.developers &&
    nextPublishers === deal.publishers &&
    nextReleaseDate === deal.releaseDate &&
    nextMetacriticScore === deal.metacriticScore &&
    nextRecommendationsTotal === deal.recommendationsTotal &&
    nextScreenshots === deal.screenshots &&
    nextTrailerUrl === deal.trailerUrl &&
    deal.steamPrice === metadata.steamPrice &&
    deal.steamDiscountPercent === metadata.steamDiscountPercent &&
    deal.steamFullPrice === metadata.steamFullPrice
  if (isUpToDate) return deal

  return {
    ...deal,
    genres: nextGenres,
    coverUrl: nextCoverUrl,
    shortDescription: nextShortDescription,
    developers: nextDevelopers,
    publishers: nextPublishers,
    releaseDate: nextReleaseDate,
    metacriticScore: nextMetacriticScore,
    recommendationsTotal: nextRecommendationsTotal,
    screenshots: nextScreenshots,
    trailerUrl: nextTrailerUrl,
    steamPrice: metadata.steamPrice,
    steamDiscountPercent: metadata.steamDiscountPercent,
    steamFullPrice: metadata.steamFullPrice
  }
}

export interface ResolveMissingMetadataResult {
  resolved: number
  failed: number
  synced: number
}

/**
 * Ação manual e independente da busca de ofertas: resolve capa/gênero/sinopse/
 * trailer da Steam pra quem ainda não tem isso em cache — tanto wishlist
 * quanto biblioteca (jogos possuídos), sem duplicar quem está nas duas listas
 * (dispara sozinho a cada busca também, mas essa é a forma de rodar isso na
 * hora, sem esperar o ciclo automático nem gastar tempo com o GG.deals).
 *
 * Sincroniza o cache de ofertas (Dashboard e Wishlist) a cada jogo resolvido
 * — não só no final — pra quem estiver de olho na tela ver o progresso
 * conforme roda, já que essa operação pode levar bastante tempo (1,5s por
 * jogo, respeitando o rate limit da Steam).
 */
export class ResolveMissingMetadata {
  private inFlight: Promise<ResolveMissingMetadataResult> | null = null

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  execute(): Promise<ResolveMissingMetadataResult> {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.run().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async run(): Promise<ResolveMissingMetadataResult> {
    const targetsByAppId = new Map<number, { appId: number; title: string }>()
    for (const item of this.cacheRepository.getWishlist()) {
      targetsByAppId.set(item.appId, { appId: item.appId, title: item.title })
    }
    for (const game of this.cacheRepository.getOwnedGames()) {
      targetsByAppId.set(game.appId, { appId: game.appId, title: game.name })
    }
    const missing = [...targetsByAppId.values()].filter((item) => this.isMetadataIncomplete(item.appId))

    this.sessionLogRepository.log(
      'info',
      `Resolvendo metadata da Steam: ${missing.length} jogo(s) sem metadata completa em cache.`
    )

    let resolved = 0
    let failed = 0
    let synced = 0

    for (const item of missing) {
      this.sessionLogRepository.log('info', `Buscando metadata da Steam pra "${item.title}"...`)
      const metadata = await this.metadataRepository.fetchMetadata(item.appId)
      if (metadata) {
        this.cacheRepository.setMetadata(metadata)
        resolved += 1
        synced += this.syncCachedDealsForAppId(item.appId, metadata)
        this.sessionLogRepository.log('success', `Metadata resolvida pra "${item.title}".`)
      } else {
        failed += 1
        this.sessionLogRepository.log('warn', `Não consegui metadata da Steam pra "${item.title}".`)
      }
      await sleep(STEAM_RATE_LIMIT_DELAY_MS)
    }

    // Rede de segurança: cobre metadata que já estava completa em cache antes
    // desta execução (então nunca passou pelo loop acima) mas nunca tinha
    // sido aplicada nas ofertas cacheadas.
    synced += this.syncAllCachedDeals()

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

  /** Aplica a metadata de um único AppID recém-resolvido nas ofertas já cacheadas, na hora. */
  private syncCachedDealsForAppId(appId: number, metadata: GameMetadata): number {
    let syncedCount = 0

    const deals = this.cacheRepository.getDeals()
    const patchedDeals = deals.map((deal) =>
      deal.appId === appId ? applyMetadataToDeal(deal, metadata) : deal
    )
    if (patchedDeals.some((deal, index) => deal !== deals[index])) {
      this.cacheRepository.setDeals(patchedDeals)
      syncedCount += 1
    }

    const wishlistDeals = this.cacheRepository.getWishlistDeals()
    const patchedWishlistDeals = wishlistDeals.map((deal) =>
      deal.appId === appId ? applyMetadataToDeal(deal, metadata) : deal
    )
    if (patchedWishlistDeals.some((deal, index) => deal !== wishlistDeals[index])) {
      this.cacheRepository.setWishlistDeals(patchedWishlistDeals)
      syncedCount += 1
    }

    return syncedCount
  }

  /** Varredura completa: aplica a metadata já em cache (de qualquer origem) em cima de todas as ofertas cacheadas. */
  private syncAllCachedDeals(): number {
    let syncedCount = 0

    const applyMetadata = (deal: GameDeal): GameDeal => {
      if (deal.appId === null) return deal
      const metadata = this.cacheRepository.getMetadata(deal.appId)
      if (!metadata) return deal
      const patched = applyMetadataToDeal(deal, metadata)
      if (patched !== deal) syncedCount += 1
      return patched
    }

    const deals = this.cacheRepository.getDeals()
    const patchedDeals = deals.map(applyMetadata)
    if (patchedDeals.some((deal, index) => deal !== deals[index])) {
      this.cacheRepository.setDeals(patchedDeals)
    }

    const wishlistDeals = this.cacheRepository.getWishlistDeals()
    const patchedWishlistDeals = wishlistDeals.map(applyMetadata)
    if (patchedWishlistDeals.some((deal, index) => deal !== wishlistDeals[index])) {
      this.cacheRepository.setWishlistDeals(patchedWishlistDeals)
    }

    return syncedCount
  }
}
