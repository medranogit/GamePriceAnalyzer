export interface PricePoint {
  timestamp: string
  currency: string | null
  retailPrice: number | null
  keyshopPrice: number | null
}

export interface LocalPriceRecord {
  appId: number
  currency: string | null
  lowestRetail: number | null
  lowestRetailAt: string | null
  lowestKeyshop: number | null
  lowestKeyshopAt: string | null
  history: PricePoint[]
}
