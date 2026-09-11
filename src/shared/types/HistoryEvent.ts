export type HistoryEventType =
  | 'deal_found'
  | 'library_sync'
  | 'wishlist_import'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'error'

export interface HistoryEvent {
  id: string
  type: HistoryEventType
  message: string
  timestamp: string
}
