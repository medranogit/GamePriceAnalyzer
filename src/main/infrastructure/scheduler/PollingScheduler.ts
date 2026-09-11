import { logger } from '../logging/logger'

export class PollingScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private currentIntervalMinutes: number | null = null

  constructor(private readonly onTick: () => Promise<void>) {}

  start(intervalMinutes: number): void {
    this.stop()
    this.currentIntervalMinutes = intervalMinutes
    this.timer = setInterval(() => this.runTick(), intervalMinutes * 60 * 1000)
    logger.info(`Polling iniciado a cada ${intervalMinutes} minutos.`)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  updateInterval(intervalMinutes: number): void {
    if (this.currentIntervalMinutes === intervalMinutes && this.timer) return
    this.start(intervalMinutes)
  }

  async runNow(): Promise<void> {
    await this.runTick()
  }

  private async runTick(): Promise<void> {
    try {
      await this.onTick()
    } catch (error) {
      logger.error('Falha no polling de ofertas', error)
    }
  }
}
