import { LastRunScheduler } from './LastRunScheduler'
import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'

const DEFAULT_INTERVAL_MINUTES = 60

export class PollingScheduler {
  private readonly scheduler: LastRunScheduler

  constructor(
    onTick: () => Promise<void>,
    pollingStateRepository: PollingStateRepository,
    sessionLogRepository: SessionLogRepository
  ) {
    this.scheduler = new LastRunScheduler(
      'Busca de ofertas',
      onTick,
      pollingStateRepository,
      sessionLogRepository,
      DEFAULT_INTERVAL_MINUTES
    )
  }

  /** Chamado só na montagem inicial do app — não reseta `lastRunAt` (não deve disparar de novo só
   * porque o app abriu). Pra mudança em runtime, ver `updateInterval`. */
  start(intervalMinutes: number): void {
    this.scheduler.setInitialIntervalMinutes(intervalMinutes)
    this.scheduler.start()
  }

  updateInterval(intervalMinutes: number): void {
    this.scheduler.setIntervalMinutes(intervalMinutes)
  }

  runNow(): Promise<void> {
    return this.scheduler.runNow()
  }

  isRunning(): boolean {
    return this.scheduler.isRunning()
  }

  logStatus(): void {
    this.scheduler.logStatus()
  }

  getLabel(): string {
    return this.scheduler.getLabel()
  }

  getLastRunAt(): string | null {
    return this.scheduler.getLastRunAt()
  }

  getIntervalMinutes(): number {
    return this.scheduler.getIntervalMinutes()
  }
}
