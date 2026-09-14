import type { HistoryEvent, HistoryEventType } from '@shared/types'

export interface HistoryRepository {
  getEvents(): HistoryEvent[]
  addEvent(type: HistoryEventType, message: string, appId?: number | null): void

  /** Remove só os eventos com esses ids — usado pelo botão "Limpar log" de uma aba específica do Histórico. */
  removeEvents(ids: string[]): void
}
