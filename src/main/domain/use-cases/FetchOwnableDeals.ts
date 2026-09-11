import type { GameDeal } from '@shared/types'
import { preserveFirstSeenAt } from '../dealOrdering'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'

/**
 * Orquestra o fluxo principal do app: pega os AppIDs da wishlist, cruza
 * preço/histórico no GG.deals, e descarta o que o usuário já possui — antes
 * de gastar cota da API com isso.
 *
 * Não filtra por desconto/keyshop/gênero aqui: a busca sempre traz TODOS os
 * candidatos (a API não é influenciada pelos filtros de exibição), e quem
 * decide o que aparecer na tela é o renderer, na hora, sem precisar buscar
 * de novo. A única filtragem que continua no domínio é "vale notificar",
 * que é uma decisão de negócio (CheckDealAlerts), não de exibição.
 */
export class FetchOwnableDeals {
  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly cacheRepository: AppCacheRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    const ownedAppIds = new Set(this.cacheRepository.getOwnedGames().map((g) => g.appId))

    const allCandidateAppIds = this.cacheRepository.getWishlist().map((w) => w.appId)

    // Descarta o que já é possuído antes de gastar cota da API do GG.deals com isso.
    const candidateAppIds = allCandidateAppIds.filter((appId) => !ownedAppIds.has(appId))

    if (candidateAppIds.length === 0) return []

    const rawDeals = await this.dealsRepository.fetchDealsBySteamAppIds(candidateAppIds)
    const deals = preserveFirstSeenAt(rawDeals, this.cacheRepository.getDeals())

    for (const deal of deals) {
      if (deal.appId === null) continue
      this.priceHistoryRepository.recordObservation(
        deal.appId,
        deal.currency,
        deal.currentRetailPrice,
        deal.currentKeyshopPrice
      )
    }

    const enriched = await this.enrichWithMetadata(deals)

    this.cacheRepository.setDeals(enriched)
    return enriched
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
        steamDiscountPercent: metadata?.steamDiscountPercent ?? null,
        steamFullPrice: metadata?.steamFullPrice ?? null
      })
    }
    return enriched
  }
}
