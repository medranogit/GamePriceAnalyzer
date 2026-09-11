export interface WishlistPriceInfo {
  appId: number
  title: string
  coverUrl?: string
  currency: string | null
  currentRetailPrice: number | null
  currentKeyshopPrice: number | null
  localLowestRetail: number | null
  localLowestRetailAt: string | null
  localLowestKeyshop: number | null
  localLowestKeyshopAt: string | null
}

export interface SteamSearchResult {
  appId: number
  name: string
  tinyImageUrl: string | null
}
