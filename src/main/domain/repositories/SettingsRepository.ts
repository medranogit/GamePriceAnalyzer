import type { AppSettings } from '@shared/types'

export interface SettingsRepository {
  get(): AppSettings
  update(partial: Partial<AppSettings>): AppSettings
}
