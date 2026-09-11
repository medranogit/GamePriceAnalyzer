import type { GameDeal } from '@shared/types'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { SteamSpecialsRepository } from '../repositories/SteamSpecialsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'

/**
 * Orquestra o fluxo principal do app: descobre candidatos (wishlist, ou
 * promoções ativas na Steam), cruza preço/histórico no GG.deals, descarta o
 * que o usuário já possui, e aplica os filtros de desconto/gênero/wishlist.
 *
 * Nota: a Prices API do GG.deals não devolve percentual de desconto nem preço
 * "cheio" — só currentRetail/currentKeyshops e o histórico de cada um. Por
 * isso o filtro de desconto mínimo usa o percentual da própria Steam
 * (enrichWithMetadata), o que significa que ofertas só na Steam entram no
 * filtro; um preço mais baixo só no GG.deals sem desconto ativo na Steam não
 * é contabilizado como "desconto".
 */
export class FetchOwnableDeals {
  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly steamSpecialsRepository: SteamSpecialsRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly settingsRepository: SettingsRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    const settings = this.settingsRepository.get()
    const ownedAppIds = new Set(this.cacheRepository.getOwnedGames().map((g) => g.appId))

    const candidateAppIds = settings.filters.wishlistOnlyMode
      ? this.cacheRepository.getWishlist().map((w) => w.appId)
      : (await this.steamSpecialsRepository.fetchCurrentSpecials()).map((s) => s.appId)

    if (candidateAppIds.length === 0) return []

    const deals = await this.dealsRepository.fetchDealsBySteamAppIds(candidateAppIds)

    for (const deal of deals) {
      if (deal.appId === null) continue
      this.priceHistoryRepository.recordObservation(
        deal.appId,
        deal.currency,
        deal.currentRetailPrice,
        deal.currentKeyshopPrice
      )
    }

    const notOwned = deals.filter((deal) => deal.appId === null || !ownedAppIds.has(deal.appId))

    const enriched = await this.enrichWithMetadata(notOwned)

    const aboveMinDiscount = enriched.filter(
      (deal) => (deal.steamDiscountPercent ?? 0) >= settings.filters.minDiscountPercent
    )

    const withKeyshopFilter = settings.filters.includeKeyshops
      ? aboveMinDiscount
      : aboveMinDiscount.map((deal) => ({ ...deal, currentKeyshopPrice: null, historicalKeyshopLow: null }))

    const finalDeals =
      settings.filters.selectedGenres.length === 0
        ? withKeyshopFilter
        : withKeyshopFilter.filter((deal) => deal.genres.some((genre) => settings.filters.selectedGenres.includes(genre)))

    this.cacheRepository.setDeals(finalDeals)
    return finalDeals
  }

  private async enrichWithMetadata(deals: GameDeal[]): Promise<GameDeal[]> {
    const enriched: GameDeal[] = []
    for (const deal of deals) {
      if (deal.appId === null) {
        enriched.push(deal)
        continue
      }

      const cached = this.cacheRepository.getMetadata(deal.appId)
      const metadata = cached ?? (await this.metadataRepository.fetchMetadata(deal.appId))
      if (metadata && !cached) {
        this.cacheRepository.setMetadata(metadata)
      }

      enriched.push({
        ...deal,
        genres: metadata?.genres ?? deal.genres,
        coverUrl: deal.coverUrl ?? metadata?.headerImageUrl ?? undefined,
        steamPrice: metadata?.steamPrice ?? null,
        steamDiscountPercent: metadata?.steamDiscountPercent ?? null
      })
    }
    return enriched
  }
}
