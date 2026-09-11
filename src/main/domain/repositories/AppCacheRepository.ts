import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'

export interface AppCacheRepository {
  getOwnedGames(): OwnedGame[]
  setOwnedGames(games: OwnedGame[]): void

  getWishlist(): WishlistItem[]
  setWishlist(items: WishlistItem[]): void

  getDeals(): GameDeal[]
  setDeals(deals: GameDeal[]): void
  /** Mescla por AppID em vez de substituir — usado por fluxos que buscam um subconjunto (ex: wishlist). */
  upsertDeals(deals: GameDeal[]): void

  getMetadata(appId: number): GameMetadata | null
  setMetadata(metadata: GameMetadata): void
}
