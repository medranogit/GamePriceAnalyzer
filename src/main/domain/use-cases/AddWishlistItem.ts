import type { WishlistItem } from '@shared/types'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'

export class AddWishlistItem {
  constructor(
    private readonly metadataRepository: GameMetadataRepository,
    private readonly cacheRepository: AppCacheRepository
  ) {}

  async execute(appId: number): Promise<WishlistItem[]> {
    const current = this.cacheRepository.getWishlist()
    if (current.some((item) => item.appId === appId)) {
      return current
    }

    const metadata = await this.metadataRepository.fetchMetadata(appId)
    const newItem: WishlistItem = {
      appId,
      title: metadata?.title ?? `AppID ${appId}`,
      storeUrl: `https://store.steampowered.com/app/${appId}/`,
      addedDate: new Date().toLocaleDateString('pt-BR'),
      releaseDate: '',
      currentPrice: metadata?.steamPrice !== null && metadata?.steamPrice !== undefined ? String(metadata.steamPrice) : null,
      discountPercent: metadata?.steamDiscountPercent ?? 0,
      reviewCount: 0,
      reviewPositivePercent: 0
    }

    const next = [...current, newItem]
    this.cacheRepository.setWishlist(next)
    return next
  }
}
