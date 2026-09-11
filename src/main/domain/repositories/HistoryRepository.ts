import type { HistoryEvent, HistoryEventType } from '@shared/types'

export interface HistoryRepository {
  getEvents(): HistoryEvent[]
  addEvent(type: HistoryEventType, message: string): void
}
