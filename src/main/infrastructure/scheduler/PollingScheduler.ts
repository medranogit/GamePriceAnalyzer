import { logger } from '../logging/logger'
import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'

/**
 * Agenda a busca de ofertas sempre com base em quando ela rodou de verdade
 * pela última vez (persistido via `PollingStateRepository`) — não num
 * `setInterval` fixo a partir do boot do app. Isso evita que abrir/fechar o
 * app com frequência dispare uma busca nova a cada vez, o que estouraria o
 * rate limit do GG.deals rapidinho. Uma busca manual (`runNow`) também conta
 * como "última execução" e empurra a próxima automática pra depois dela.
 */
export class PollingScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private currentIntervalMinutes: number | null = null
  private inFlight: Promise<void> | null = null

  constructor(
    private readonly onTick: () => Promise<void>,
    private readonly pollingStateRepository: PollingStateRepository
  ) {}

  start(intervalMinutes: number): void {
    this.currentIntervalMinutes = intervalMinutes
    this.scheduleNext()
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  updateInterval(intervalMinutes: number): void {
    if (this.currentIntervalMinutes === intervalMinutes && this.timer) return
    this.currentIntervalMinutes = intervalMinutes
    this.scheduleNext()
  }

  /** Roda agora, fora do agendamento, e reagenda a próxima automática a partir deste momento. */
  async runNow(): Promise<void> {
    this.stop()
    await this.runTick()
    this.scheduleNext()
  }

  private scheduleNext(): void {
    this.stop()
    const intervalMinutes = this.currentIntervalMinutes ?? 65
    const intervalMs = intervalMinutes * 60 * 1000
    const lastRunAt = this.pollingStateRepository.getLastRunAt()
    const elapsedMs = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() : Infinity
    const delayMs = Math.max(intervalMs - elapsedMs, 0)

    logger.info(
      delayMs > 0
        ? `Próxima busca de ofertas em ${Math.ceil(delayMs / 60_000)} min (intervalo de ${intervalMinutes} min desde a última execução).`
        : `Buscando ofertas agora (já passou o intervalo de ${intervalMinutes} min desde a última execução).`
    )

    this.timer = setTimeout(() => {
      void this.runTick().then(() => this.scheduleNext())
    }, delayMs)
  }

  private runTick(): Promise<void> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.onTick()
      .catch((error) => {
        logger.error('Falha no polling de ofertas', error)
      })
      .finally(() => {
        this.pollingStateRepository.setLastRunAt(new Date().toISOString())
        this.inFlight = null
      })

    return this.inFlight
  }
}
