import type { GameDeal, GameMetadata } from '@shared/types'
import type { AppCacheRepository } from './repositories/AppCacheRepository'

/**
 * Aplica a metadata da Steam em cima de uma oferta cacheada.
 *
 * `deal`/`metadata` podem ter sido salvos em disco por uma versão anterior do app, sem os campos mais
 * novos — daí o `?? []`/`?? null` em vez de acessar os campos direto (ver regressão de `steamFullPrice`
 * em dealPricing.ts).
 *
 * `preferFreshMetadata` controla quem ganha quando os dois já têm valor: `false` (padrão, usado por
 * ResolveMissingMetadata) só preenche o que falta na oferta, sem sobrescrever o que já tinha — `true`
 * (usado por RefreshLibraryMetadata) sempre prioriza o valor mais recente vindo da Steam, pra pegar
 * mudanças (capa nova, sinopse editada, gênero atualizado etc.) em quem já tinha tudo cacheado.
 */
export function applyMetadataToDeal(
  deal: GameDeal,
  metadata: GameMetadata,
  preferFreshMetadata = false
): GameDeal {
  const dealDevelopers = deal.developers ?? []
  const dealPublishers = deal.publishers ?? []
  const dealScreenshots = deal.screenshots ?? []
  const metadataGenres = metadata.genres ?? []
  const metadataDevelopers = metadata.developers ?? []
  const metadataPublishers = metadata.publishers ?? []
  const metadataScreenshots = metadata.screenshots ?? []

  const nextCoverUrl = preferFreshMetadata
    ? (metadata.headerImageUrl ?? deal.coverUrl ?? undefined)
    : (deal.coverUrl ?? metadata.headerImageUrl ?? undefined)
  const nextGenres = metadataGenres.length > 0 ? metadataGenres : deal.genres
  const nextShortDescription = preferFreshMetadata
    ? (metadata.shortDescription ?? deal.shortDescription ?? null)
    : (deal.shortDescription ?? metadata.shortDescription ?? null)
  const nextDevelopers = preferFreshMetadata
    ? metadataDevelopers.length > 0
      ? metadataDevelopers
      : dealDevelopers
    : dealDevelopers.length > 0
      ? dealDevelopers
      : metadataDevelopers
  const nextPublishers = preferFreshMetadata
    ? metadataPublishers.length > 0
      ? metadataPublishers
      : dealPublishers
    : dealPublishers.length > 0
      ? dealPublishers
      : metadataPublishers
  const nextReleaseDate = preferFreshMetadata
    ? (metadata.releaseDate ?? deal.releaseDate ?? null)
    : (deal.releaseDate ?? metadata.releaseDate ?? null)
  const nextMetacriticScore = preferFreshMetadata
    ? (metadata.metacriticScore ?? deal.metacriticScore ?? null)
    : (deal.metacriticScore ?? metadata.metacriticScore ?? null)
  const nextRecommendationsTotal = preferFreshMetadata
    ? (metadata.recommendationsTotal ?? deal.recommendationsTotal ?? null)
    : (deal.recommendationsTotal ?? metadata.recommendationsTotal ?? null)
  const nextScreenshots = preferFreshMetadata
    ? metadataScreenshots.length > 0
      ? metadataScreenshots
      : dealScreenshots
    : dealScreenshots.length > 0
      ? dealScreenshots
      : metadataScreenshots
  const nextTrailerUrl = preferFreshMetadata
    ? (metadata.trailerUrl ?? deal.trailerUrl ?? null)
    : (deal.trailerUrl ?? metadata.trailerUrl ?? null)

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

/** Aplica a metadata de um único AppID nas ofertas já cacheadas (Dashboard e Wishlist), na hora. */
export function syncCachedDealsForAppId(
  cacheRepository: AppCacheRepository,
  appId: number,
  metadata: GameMetadata,
  preferFreshMetadata = false
): number {
  let syncedCount = 0

  const deals = cacheRepository.getDeals()
  const patchedDeals = deals.map((deal) =>
    deal.appId === appId ? applyMetadataToDeal(deal, metadata, preferFreshMetadata) : deal
  )
  if (patchedDeals.some((deal, index) => deal !== deals[index])) {
    cacheRepository.setDeals(patchedDeals)
    syncedCount += 1
  }

  const wishlistDeals = cacheRepository.getWishlistDeals()
  const patchedWishlistDeals = wishlistDeals.map((deal) =>
    deal.appId === appId ? applyMetadataToDeal(deal, metadata, preferFreshMetadata) : deal
  )
  if (patchedWishlistDeals.some((deal, index) => deal !== wishlistDeals[index])) {
    cacheRepository.setWishlistDeals(patchedWishlistDeals)
    syncedCount += 1
  }

  return syncedCount
}

/** Varredura completa: aplica a metadata já em cache (de qualquer origem) em cima de todas as ofertas cacheadas. */
export function syncAllCachedDeals(cacheRepository: AppCacheRepository, preferFreshMetadata = false): number {
  let syncedCount = 0

  const applyMetadata = (deal: GameDeal): GameDeal => {
    if (deal.appId === null) return deal
    const metadata = cacheRepository.getMetadata(deal.appId)
    if (!metadata) return deal
    const patched = applyMetadataToDeal(deal, metadata, preferFreshMetadata)
    if (patched !== deal) syncedCount += 1
    return patched
  }

  const deals = cacheRepository.getDeals()
  const patchedDeals = deals.map(applyMetadata)
  if (patchedDeals.some((deal, index) => deal !== deals[index])) {
    cacheRepository.setDeals(patchedDeals)
  }

  const wishlistDeals = cacheRepository.getWishlistDeals()
  const patchedWishlistDeals = wishlistDeals.map(applyMetadata)
  if (patchedWishlistDeals.some((deal, index) => deal !== wishlistDeals[index])) {
    cacheRepository.setWishlistDeals(patchedWishlistDeals)
  }

  return syncedCount
}
