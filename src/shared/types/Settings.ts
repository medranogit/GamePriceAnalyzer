export interface FilterSettings {
  minDiscountPercent: number
  minPrice: number | null
  maxPrice: number | null
  includeKeyshops: boolean
  selectedGenres: string[]
  onlyHistoricalLow: boolean
}

export interface PollingSettings {
  intervalMinutes: number
  wishlistSyncIntervalMinutes: number
  librarySyncIntervalMinutes: number
  metadataBackfillIntervalMinutes: number
  quietHoursStart: string | null
  quietHoursEnd: string | null
  /** Desconto mínimo (efetivo ou da Steam) pra disparar notificação — independente do filtro de exibição do Dashboard. */
  notifyMinDiscountPercent: number
  /** Notifica também quando o preço já é o menor histórico do GG.deals, mesmo sem atingir o desconto mínimo acima. */
  notifyOnHistoricalLow: boolean
}

export interface AppSettings {
  steamId64: string | null
  autoStartOnBoot: boolean
  /** Baixa capa/screenshots/thumbnails de trailer pra disco ao resolver metadata, pra não depender da
   * Steam pra sempre exibi-las. Independente de `downloadTrailersLocally` (o vídeo em si). */
  downloadImagesLocally: boolean
  /** Baixa o pacote HLS completo (manifest + segmentos) de cada trailer pra disco — bem mais pesado que
   * as imagens, por isso é um toggle separado do `downloadImagesLocally`. */
  downloadTrailersLocally: boolean
  /** Volume (0-100) com que os vídeos de trailer já começam a tocar. */
  defaultVideoVolumePercent: number
  filters: FilterSettings
  polling: PollingSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  steamId64: null,
  autoStartOnBoot: false,
  downloadImagesLocally: false,
  downloadTrailersLocally: false,
  defaultVideoVolumePercent: 30,
  filters: {
    minDiscountPercent: 50,
    minPrice: null,
    maxPrice: null,
    includeKeyshops: true,
    selectedGenres: [],
    onlyHistoricalLow: false
  },
  polling: {
    intervalMinutes: 70,
    wishlistSyncIntervalMinutes: 120,
    librarySyncIntervalMinutes: 30,
    metadataBackfillIntervalMinutes: 20,
    quietHoursStart: null,
    quietHoursEnd: null,
    notifyMinDiscountPercent: 50,
    notifyOnHistoricalLow: true
  }
}
