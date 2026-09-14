import { randomUUID } from 'node:crypto'
import type { HistoryEvent, HistoryEventType } from '@shared/types'
import type { HistoryRepository } from '../../domain/repositories/HistoryRepository'
import { JsonFileStore } from './JsonFileStore'

const MAX_EVENTS = 500

interface HistorySchema {
  events: HistoryEvent[]
}

/** Log de tudo que o app fez: ofertas notificadas, sincronizações, mudanças na wishlist. */
export class JsonHistoryRepository implements HistoryRepository {
  private readonly store = new JsonFileStore<HistorySchema>('history.json', { events: [] })

  getEvents(): HistoryEvent[] {
    return this.store.read().events
  }

  addEvent(type: HistoryEventType, message: string, appId?: number | null): void {
    const event: HistoryEvent = {
      id: randomUUID(),
      type,
      message,
      timestamp: new Date().toISOString(),
      appId
    }
    const current = this.store.read().events
    this.store.write({ events: [event, ...current].slice(0, MAX_EVENTS) })
  }

  removeEvents(ids: string[]): void {
    const idSet = new Set(ids)
    const current = this.store.read().events
    this.store.write({ events: current.filter((event) => !idSet.has(event.id)) })
  }
}
