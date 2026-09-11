import type { WishlistItem } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'

export class RemoveWishlistItem {
  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  execute(appId: number): WishlistItem[] {
    const current = this.cacheRepository.getWishlist()
    const removed = current.find((item) => item.appId === appId)
    const next = current.filter((item) => item.appId !== appId)
    this.cacheRepository.setWishlist(next)
    if (removed) {
      this.historyRepository.addEvent('wishlist_remove', `Removido da wishlist: ${removed.title}.`)
    }
    return next
  }
}
