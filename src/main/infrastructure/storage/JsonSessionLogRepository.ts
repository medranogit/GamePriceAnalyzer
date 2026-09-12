import { randomUUID } from 'node:crypto'
import type { SessionLogEntry, SessionLogLevel, SessionLogSession } from '@shared/types'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import { JsonFileStore } from './JsonFileStore'

const MAX_SESSIONS = 100
const MAX_ENTRIES_PER_SESSION = 2000

interface SessionLogSchema {
  sessions: SessionLogSession[]
  entriesBySessionId: Record<string, SessionLogEntry[]>
}

const EMPTY_SCHEMA: SessionLogSchema = { sessions: [], entriesBySessionId: {} }

export class JsonSessionLogRepository implements SessionLogRepository {
  private readonly store = new JsonFileStore<SessionLogSchema>('session-log.json', EMPTY_SCHEMA)
  private currentSessionId: string | null = null

  startSession(): string {
    const schema = this.store.read()
    const now = new Date().toISOString()

    // Se o app foi encerrado de forma abrupta na vez anterior (crash, sem
    // passar pelo before-quit), a sessão antiga ficou presa em "running" —
    // fecha ela sozinha antes de abrir a nova.
    const closedStaleSessions = schema.sessions.map((session) =>
      session.status === 'running' ? { ...session, status: 'closed' as const, finishedAt: now } : session
    )

    const id = randomUUID()
    const session: SessionLogSession = { id, startedAt: now, finishedAt: null, status: 'running' }

    const sessions = [session, ...closedStaleSessions].slice(0, MAX_SESSIONS)
    const keptIds = new Set(sessions.map((s) => s.id))
    const entriesBySessionId = Object.fromEntries(
      Object.entries(schema.entriesBySessionId).filter(([sessionId]) => keptIds.has(sessionId))
    )
    entriesBySessionId[id] = []

    this.store.write({ sessions, entriesBySessionId })
    this.currentSessionId = id
    return id
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

  endSession(): void {
    if (!this.currentSessionId) return
    const finishedId = this.currentSessionId
    const schema = this.store.read()
    const sessions = schema.sessions.map((s) =>
      s.id === finishedId ? { ...s, status: 'closed' as const, finishedAt: new Date().toISOString() } : s
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

  deleteSession(sessionId: string): void {
    const schema = this.store.read()
    const sessions = schema.sessions.filter((s) => s.id !== sessionId)
    const { [sessionId]: _removed, ...entriesBySessionId } = schema.entriesBySessionId
    this.store.write({ sessions, entriesBySessionId })
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null
    }
  }
}
