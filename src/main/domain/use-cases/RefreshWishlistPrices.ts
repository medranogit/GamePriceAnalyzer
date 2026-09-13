import type { WishlistPriceInfo } from '@shared/types'
import { preserveFirstSeenAt } from '../dealOrdering'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

/**
 * Busca o preço atual (loja oficial e keyshop) de cada jogo da wishlist no
 * GG.deals, alimenta o histórico local de menor preço já visto por este
 * programa, e devolve os dois lado a lado pra tela de Wishlist.
 */
export class RefreshWishlistPrices {
  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(): Promise<WishlistPriceInfo[]> {
    this.sessionLogRepository.log('info', 'Iniciando atualização de preços da wishlist...')

    try {
      const wishlist = this.cacheRepository.getWishlist()
      if (wishlist.length === 0) {
        this.sessionLogRepository.log('info', 'Wishlist vazia, nada pra atualizar.')
        return []
      }

      const { deals: rawDeals } = await this.dealsRepository.fetchDealsBySteamAppIds(
        wishlist.map((w) => w.appId)
      )
      const deals = preserveFirstSeenAt(rawDeals, this.cacheRepository.getWishlistDeals())
      this.cacheRepository.setWishlistDeals(deals.filter((d) => d.appId !== null))
      const dealsByAppId = new Map(deals.filter((d) => d.appId !== null).map((d) => [d.appId as number, d]))

      const results: WishlistPriceInfo[] = []
      for (const item of wishlist) {
        const deal = dealsByAppId.get(item.appId)

        const record = this.priceHistoryRepository.recordObservation(
          item.appId,
          deal?.currency ?? null,
          deal?.currentRetailPrice ?? null,
          deal?.currentKeyshopPrice ?? null
        )

        const cachedMetadata = this.cacheRepository.getMetadata(item.appId)
        const metadata = cachedMetadata ?? (await this.metadataRepository.fetchMetadata(item.appId))
        if (metadata && !cachedMetadata) {
          this.cacheRepository.setMetadata(metadata)
        }

        results.push({
          appId: item.appId,
          title: deal?.title ?? metadata?.title ?? item.title,
          coverUrl: metadata?.headerImageUrl ?? undefined,
          currency: record.currency,
          currentRetailPrice: deal?.currentRetailPrice ?? null,
          currentKeyshopPrice: deal?.currentKeyshopPrice ?? null,
          localLowestRetail: record.lowestRetail,
          localLowestRetailAt: record.lowestRetailAt,
          localLowestKeyshop: record.lowestKeyshop,
          localLowestKeyshopAt: record.lowestKeyshopAt
        })
      }

      this.sessionLogRepository.log(
        'success',
        `Atualização de preços da wishlist concluída: ${results.length} jogo(s) atualizado(s).`
      )
      return results
    } catch (error) {
      this.sessionLogRepository.log(
        'error',
        `Falha ao atualizar preços da wishlist: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }
}
