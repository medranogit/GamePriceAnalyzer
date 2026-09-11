export type SessionLogLevel = 'info' | 'success' | 'warn' | 'error'

export type SessionLogKind = 'deals_poll' | 'wishlist_sync' | 'library_sync' | 'wishlist_refresh'

export interface SessionLogEntry {
  timestamp: string
  level: SessionLogLevel
  message: string
}

export interface SessionLogSession {
  id: string
  kind: SessionLogKind
  label: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'completed' | 'error'
}
