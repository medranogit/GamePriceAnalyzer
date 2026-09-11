export interface GameDeal {
  appId: number | null
  title: string
  coverUrl?: string
  genres: string[]
  ggDealsUrl: string
  currency: string | null
  currentRetailPrice: number | null
  currentKeyshopPrice: number | null
  historicalRetailLow: number | null
  historicalKeyshopLow: number | null
  steamPrice: number | null
  steamDiscountPercent: number | null
  /** Preço "cheio" da Steam, sem desconto ativo — referência pra calcular economia em keyshops. */
  steamFullPrice: number | null
  /** Quando essa oferta apareceu pela primeira vez pra este programa (persiste entre buscas). */
  firstSeenAt: string
}
