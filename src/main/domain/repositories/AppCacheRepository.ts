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
  getAllMetadata(): GameMetadata[]

  /**
   * AppIDs que ainda faltam ser buscados no ciclo de busca de ofertas em andamento — vazio quando não
   * há ciclo interrompido. Permite retomar de onde parou (em vez de recomeçar do lote 1) se o app for
   * fechado no meio de uma busca grande. Ver FetchOwnableDeals.
   */
  getPendingDealsAppIds(): number[]
  setPendingDealsAppIds(appIds: number[]): void
}
