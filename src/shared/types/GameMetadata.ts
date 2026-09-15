export interface GameTrailer {
  url: string
  thumbnailUrl: string | null
}

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
  developers: string[]
  publishers: string[]
  releaseDate: string | null
  metacriticScore: number | null
  recommendationsTotal: number | null
  screenshots: string[]
  trailers: GameTrailer[]
  /** AppIDs das DLCs deste jogo, segundo a própria Steam — vazio se não tiver nenhuma. */
  dlcAppIds: number[]
  /** true quando ESTE appId é, ele mesmo, uma DLC (não o jogo base). */
  isDlc: boolean
  /** AppID do jogo base, só quando `isDlc` é true. */
  parentAppId: number | null
}
