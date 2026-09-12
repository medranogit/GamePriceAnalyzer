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
  filters: FilterSettings
  polling: PollingSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  steamId64: null,
  autoStartOnBoot: false,
  filters: {
    minDiscountPercent: 50,
    minPrice: null,
    maxPrice: null,
    includeKeyshops: true,
    selectedGenres: [],
    onlyHistoricalLow: false
  },
  polling: {
    intervalMinutes: 60,
    wishlistSyncIntervalMinutes: 60,
    quietHoursStart: null,
    quietHoursEnd: null,
    notifyMinDiscountPercent: 50,
    notifyOnHistoricalLow: true
  }
}
