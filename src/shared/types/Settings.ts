export interface FilterSettings {
  minDiscountPercent: number
  minPrice: number | null
  maxPrice: number | null
  includeKeyshops: boolean
  selectedGenres: string[]
}

export interface PollingSettings {
  intervalMinutes: number
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
    selectedGenres: []
  },
  polling: {
    // 65 (não 60) de propósito: dá uma margem além da janela de 1h do rate
    // limit do GG.deals, em vez de bater exatamente na borda.
    intervalMinutes: 65,
    quietHoursStart: null,
    quietHoursEnd: null
  }
}
