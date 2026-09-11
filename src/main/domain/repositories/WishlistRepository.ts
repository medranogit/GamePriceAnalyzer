import type { WishlistItem } from '@shared/types'

export interface WishlistRepository {
  importFromFile(filePath: string): Promise<WishlistItem[]>
}
