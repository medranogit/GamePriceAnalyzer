export interface FilterSettings {
  minDiscountPercent: number
  includeKeyshops: boolean
  wishlistOnlyMode: boolean
  selectedGenres: string[]
}

export interface PollingSettings {
  intervalMinutes: number
  quietHoursStart: string | null
  quietHoursEnd: string | null
}

export interface AppSettings {
  steamId64: string | null
  wishlistFilePath: string | null
  autoStartOnBoot: boolean
  filters: FilterSettings
  polling: PollingSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  steamId64: null,
  wishlistFilePath: null,
  autoStartOnBoot: false,
  filters: {
    minDiscountPercent: 50,
    includeKeyshops: true,
    wishlistOnlyMode: false,
    selectedGenres: []
  },
  polling: {
    intervalMinutes: 30,
    quietHoursStart: null,
    quietHoursEnd: null
  }
}
