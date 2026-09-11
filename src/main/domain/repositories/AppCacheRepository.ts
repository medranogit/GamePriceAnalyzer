import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'

export interface AppCacheRepository {
  getOwnedGames(): OwnedGame[]
  setOwnedGames(games: OwnedGame[]): void

  getWishlist(): WishlistItem[]
  setWishlist(items: WishlistItem[]): void

  /** Ofertas atuais do fluxo principal (Dashboard) — substituído por completo a cada busca. */
  getDeals(): GameDeal[]
  setDeals(deals: GameDeal[]): void

  /** Preços atuais buscados pela aba Wishlist — cache separado, não polui a lista de Ofertas. */
  getWishlistDeals(): GameDeal[]
  setWishlistDeals(deals: GameDeal[]): void

  getMetadata(appId: number): GameMetadata | null
  setMetadata(metadata: GameMetadata): void
}
