import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'
import { JsonFileStore } from './JsonFileStore'

interface PollingStateSchema {
  lastRunAt: string | null
}

export class JsonPollingStateRepository implements PollingStateRepository {
  private readonly store = new JsonFileStore<PollingStateSchema>('polling-state.json', { lastRunAt: null })

  getLastRunAt(): string | null {
    return this.store.read().lastRunAt
  }

  setLastRunAt(isoTimestamp: string): void {
    this.store.write({ lastRunAt: isoTimestamp })
  }
}
