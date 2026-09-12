/**
 * Guarda quando foi a última execução do polling de ofertas — permite, ao
 * abrir o app, calcular quanto ainda falta pro intervalo configurado em vez
 * de sempre disparar uma busca imediata (o que estouraria o rate limit do
 * GG.deals se o usuário abrir/fechar o app com frequência).
 */
export interface PollingStateRepository {
  getLastRunAt(): string | null
  setLastRunAt(isoTimestamp: string): void
}
