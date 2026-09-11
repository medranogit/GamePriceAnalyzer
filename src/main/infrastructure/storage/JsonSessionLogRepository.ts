import { randomUUID } from 'node:crypto'
import type { SessionLogEntry, SessionLogKind, SessionLogLevel, SessionLogSession } from '@shared/types'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import { JsonFileStore } from './JsonFileStore'

const MAX_SESSIONS = 100
const MAX_ENTRIES_PER_SESSION = 500

interface SessionLogSchema {
  sessions: SessionLogSession[]
  entriesBySessionId: Record<string, SessionLogEntry[]>
}

const EMPTY_SCHEMA: SessionLogSchema = { sessions: [], entriesBySessionId: {} }

export class JsonSessionLogRepository implements SessionLogRepository {
  private readonly store = new JsonFileStore<SessionLogSchema>('session-log.json', EMPTY_SCHEMA)
  private currentSessionId: string | null = null

  startSession(kind: SessionLogKind, label: string): void {
    if (this.currentSessionId) {
      this.finishSession('error', 'Sessão interrompida pelo início de uma nova operação.')
    }

    const schema = this.store.read()
    const id = randomUUID()
    const session: SessionLogSession = {
      id,
      kind,
      label,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running'
    }

    const sessions = [session, ...schema.sessions].slice(0, MAX_SESSIONS)
    const keptIds = new Set(sessions.map((s) => s.id))
    const entriesBySessionId = Object.fromEntries(
      Object.entries(schema.entriesBySessionId).filter(([sessionId]) => keptIds.has(sessionId))
    )
    entriesBySessionId[id] = []

    this.store.write({ sessions, entriesBySessionId })
    this.currentSessionId = id
  }

  log(level: SessionLogLevel, message: string): void {
    if (!this.currentSessionId) return
    const schema = this.store.read()
    const entries = schema.entriesBySessionId[this.currentSessionId] ?? []
    const nextEntries = [...entries, { timestamp: new Date().toISOString(), level, message }].slice(
      -MAX_ENTRIES_PER_SESSION
    )
    this.store.write({
      ...schema,
      entriesBySessionId: { ...schema.entriesBySessionId, [this.currentSessionId]: nextEntries }
    })
  }

  finishSession(status: 'completed' | 'error', message: string): void {
    if (!this.currentSessionId) return
    const finishedId = this.currentSessionId
    this.log(status === 'completed' ? 'success' : 'error', message)

    const schema = this.store.read()
    const sessions = schema.sessions.map((s) =>
      s.id === finishedId ? { ...s, status, finishedAt: new Date().toISOString() } : s
    )
    this.store.write({ ...schema, sessions })
    this.currentSessionId = null
  }

  listSessions(): SessionLogSession[] {
    return this.store.read().sessions
  }

  getEntries(sessionId: string): SessionLogEntry[] {
    return this.store.read().entriesBySessionId[sessionId] ?? []
  }
}
