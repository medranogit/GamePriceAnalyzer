import type { SessionLogEntry, SessionLogLevel, SessionLogSession } from '@shared/types'

/**
 * Log técnico único por sessão do app — uma sessão vai do momento em que o
 * app abre até ser encerrado de verdade (menu da bandeja), com tudo que
 * acontece nesse período (buscas, sincronizações, chamadas de API, erros)
 * misturado em ordem cronológica. Diferente do Histórico, que só guarda o
 * resumo de eventos de negócio, não o passo a passo técnico.
 */
export interface SessionLogRepository {
  startSession(): string
  log(level: SessionLogLevel, message: string): void
  endSession(): void
  listSessions(): SessionLogSession[]
  getEntries(sessionId: string): SessionLogEntry[]
}
