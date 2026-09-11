import type { SessionLogEntry, SessionLogKind, SessionLogLevel, SessionLogSession } from '@shared/types'

/**
 * Log técnico por sessão (uma execução de uma operação: busca de ofertas,
 * sincronização de wishlist/biblioteca, refresh de preço) — granular o
 * bastante pra mostrar lote-a-lote de chamada de API e espera de rate limit,
 * diferente do Histórico (que só guarda o resumo final de cada operação).
 *
 * Sempre existe no máximo uma sessão "current" por vez — `log`/`finishSession`
 * sempre se aplicam a ela, sem precisar passar um id por toda a cadeia de
 * chamadas (use-cases → repositórios → client HTTP).
 */
export interface SessionLogRepository {
  startSession(kind: SessionLogKind, label: string): void
  log(level: SessionLogLevel, message: string): void
  finishSession(status: 'completed' | 'error', message: string): void
  listSessions(): SessionLogSession[]
  getEntries(sessionId: string): SessionLogEntry[]
}
