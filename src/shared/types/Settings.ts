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
    quietHoursEnd: null
  }
}
