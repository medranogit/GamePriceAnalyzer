export type SessionLogLevel = 'info' | 'success' | 'warn' | 'error'

export interface SessionLogEntry {
  timestamp: string
  level: SessionLogLevel
  message: string
}

export interface SessionLogSession {
  id: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'closed'
}
