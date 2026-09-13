import type { GameTrailer } from './GameMetadata'

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
  shortDescription: string | null
  developers: string[]
  publishers: string[]
  releaseDate: string | null
  metacriticScore: number | null
  recommendationsTotal: number | null
  screenshots: string[]
  trailers: GameTrailer[]
  /** Quando essa oferta apareceu pela primeira vez pra este programa (persiste entre buscas). */
  firstSeenAt: string
  /** Quando o preço foi realmente reconferido no GG.deals pela última vez — diferente de `firstSeenAt`
   * (que não muda depois da primeira vez). Ausente em cache salvo antes desse campo existir. Usado pra
   * ordenar Ofertas com quem foi atualizado mais recentemente primeiro. */
  priceUpdatedAt?: string
}
