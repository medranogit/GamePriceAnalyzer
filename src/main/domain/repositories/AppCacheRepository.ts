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

  /**
   * AppIDs que ainda faltam ser reconferidos no ciclo de refresh de metadata da biblioteca (24h) em
   * andamento — mesma ideia de `getPendingDealsAppIds`, mas pro RefreshLibraryMetadata: se o app fechar
   * no meio de uma reconferência grande, a próxima execução retoma de onde parou em vez de recomeçar.
   */
  getPendingLibraryRefreshAppIds(): number[]
  setPendingLibraryRefreshAppIds(appIds: number[]): void

  /**
   * DLCs que o usuário confirmou manualmente que já possui — a Steam não lista DLC em `GetOwnedGames`
   * (nem mapas de expansão gratuitos), então não tem como detectar isso automaticamente. Uma vez marcada
   * aqui, a DLC some das Ofertas do mesmo jeito que um jogo realmente possuído (ver FetchOwnableDeals).
   */
  getManuallyOwnedDlcAppIds(): number[]
  setManuallyOwnedDlcAppIds(appIds: number[]): void
}
