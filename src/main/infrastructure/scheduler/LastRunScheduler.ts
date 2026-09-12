import { logger } from '../logging/logger'
import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'

/**
 * Agenda uma tarefa recorrente sempre com base em quando ela rodou de
 * verdade pela última vez (persistido via `PollingStateRepository`) — não
 * num `setInterval` fixo a partir do boot do app. Isso evita que abrir/fechar
 * o app com frequência dispare a tarefa de novo a cada vez. Reaproveitado
 * tanto pela busca de ofertas (`PollingScheduler`) quanto pela sincronização
 * periódica da wishlist.
 */
export class LastRunScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null

  constructor(
    private readonly label: string,
    private readonly onTick: () => Promise<void>,
    private readonly lastRunRepository: PollingStateRepository,
    private readonly sessionLogRepository: SessionLogRepository,
    private intervalMinutes: number
  ) {}

  start(): void {
    this.scheduleNext()
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  setIntervalMinutes(intervalMinutes: number): void {
    if (this.intervalMinutes === intervalMinutes && this.timer) return
    this.intervalMinutes = intervalMinutes
    this.scheduleNext()
  }

  /** Roda agora, fora do agendamento, e reagenda a próxima automática a partir deste momento. */
  async runNow(): Promise<void> {
    this.stop()
    await this.runTick()
    this.scheduleNext()
  }

  /** Registra que a tarefa rodou por fora (ex: botão manual numa tela) e reagenda a partir daí. */
  notifyExternalRun(): void {
    this.lastRunRepository.setLastRunAt(new Date().toISOString())
    this.scheduleNext()
  }

  /** Registra no log (sem mexer no agendamento) quanto falta pra próxima execução — usado pelo ping periódico. */
  logStatus(): void {
    const message = this.buildStatusMessage(this.computeDelayMs())
    logger.info(message)
    this.sessionLogRepository.log('info', message)
  }

  private computeDelayMs(): number {
    const intervalMs = this.intervalMinutes * 60 * 1000
    const lastRunAt = this.lastRunRepository.getLastRunAt()
    const elapsedMs = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() : Infinity
    return Math.max(intervalMs - elapsedMs, 0)
  }

  private buildStatusMessage(delayMs: number): string {
    return delayMs > 0
      ? `${this.label} (${this.intervalMinutes}): próxima em ${Math.ceil(delayMs / 60_000)} min`
      : `${this.label} (${this.intervalMinutes}): rodando agora`
  }

  private scheduleNext(): void {
    this.stop()
    const delayMs = this.computeDelayMs()
    const message = this.buildStatusMessage(delayMs)
    logger.info(message)
    this.sessionLogRepository.log('info', message)

    this.timer = setTimeout(() => {
      void this.runTick().then(() => this.scheduleNext())
    }, delayMs)
  }

  private runTick(): Promise<void> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.onTick()
      .catch((error) => {
        logger.error(`Falha em: ${this.label}`, error)
      })
      .finally(() => {
        this.lastRunRepository.setLastRunAt(new Date().toISOString())
        this.inFlight = null
      })

    return this.inFlight
  }
}
