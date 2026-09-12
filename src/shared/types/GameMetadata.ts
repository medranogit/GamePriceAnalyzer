export interface GameMetadata {
  appId: number
  title: string | null
  genres: string[]
  headerImageUrl: string | null
  steamPrice: number | null
  steamDiscountPercent: number | null
  /** Preço "cheio" da Steam, sem desconto ativo — referência pra calcular economia em keyshops. */
  steamFullPrice: number | null
  shortDescription: string | null
}
