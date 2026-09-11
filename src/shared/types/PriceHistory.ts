export interface LocalPriceRecord {
  appId: number
  currency: string | null
  lowestRetail: number | null
  lowestRetailAt: string | null
  lowestKeyshop: number | null
  lowestKeyshopAt: string | null
}
