export interface OwnedGame {
  appId: number
  name: string
  playtimeForeverMinutes: number
  iconUrl?: string
}

export interface WishlistItem {
  appId: number
  title: string
  storeUrl: string
  addedDate: string
  releaseDate: string
  currentPrice: string | null
  discountPercent: number
  reviewCount: number
  reviewPositivePercent: number
}
