import type { WishlistItem } from '@shared/types'
import type { WishlistRepository } from '../repositories/WishlistRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'

export class ImportWishlist {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  async execute(filePath: string): Promise<WishlistItem[]> {
    const items = await this.wishlistRepository.importFromFile(filePath)
    this.cacheRepository.setWishlist(items)
    this.historyRepository.addEvent('wishlist_import', `Wishlist importada: ${items.length} itens.`)
    return items
  }
}
