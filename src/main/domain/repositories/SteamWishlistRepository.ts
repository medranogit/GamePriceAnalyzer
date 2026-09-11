export interface SteamWishlistEntry {
  appId: number
  addedAt: string
}

export interface SteamWishlistRepository {
  fetchWishlistAppIds(steamId64: string): Promise<SteamWishlistEntry[]>
}
