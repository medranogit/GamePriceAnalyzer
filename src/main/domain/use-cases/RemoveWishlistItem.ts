import type { WishlistItem } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'

export class RemoveWishlistItem {
  constructor(private readonly cacheRepository: AppCacheRepository) {}

  execute(appId: number): WishlistItem[] {
    const next = this.cacheRepository.getWishlist().filter((item) => item.appId !== appId)
    this.cacheRepository.setWishlist(next)
    return next
  }
}
