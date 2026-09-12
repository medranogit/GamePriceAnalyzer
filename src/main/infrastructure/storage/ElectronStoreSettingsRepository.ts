import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import { JsonFileStore } from './JsonFileStore'

export class ElectronStoreSettingsRepository implements SettingsRepository {
  private readonly store = new JsonFileStore<AppSettings>('settings.json', DEFAULT_SETTINGS)

  get(): AppSettings {
    const stored = this.store.read()
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      filters: { ...DEFAULT_SETTINGS.filters, ...stored.filters },
      polling: { ...DEFAULT_SETTINGS.polling, ...stored.polling }
    }
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const current = this.get()
    const next: AppSettings = {
      ...current,
      ...partial,
      filters: { ...current.filters, ...partial.filters },
      polling: { ...current.polling, ...partial.polling }
    }
    this.store.write(next)
    return next
  }
}
