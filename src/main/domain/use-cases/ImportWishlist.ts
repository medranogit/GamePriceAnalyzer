import type { WishlistItem } from '@shared/types'
import type { WishlistRepository } from '../repositories/WishlistRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'

export class ImportWishlist {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly cacheRepository: AppCacheRepository
  ) {}

  async execute(filePath: string): Promise<WishlistItem[]> {
    const items = await this.wishlistRepository.importFromFile(filePath)
    this.cacheRepository.setWishlist(items)
    return items
  }
}
