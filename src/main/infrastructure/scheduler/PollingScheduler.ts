import { logger } from '../logging/logger'

export class PollingScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private currentIntervalMinutes: number | null = null
  private inFlight: Promise<void> | null = null

  constructor(private readonly onTick: () => Promise<void>) {}

  start(intervalMinutes: number): void {
    this.stop()
    this.currentIntervalMinutes = intervalMinutes
    this.timer = setInterval(() => void this.runTick(), intervalMinutes * 60 * 1000)
    logger.info(`Polling iniciado a cada ${intervalMinutes} minutos.`)
    void this.runTick()
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

  /**
   * Se já existe uma busca em andamento (automática ou disparada manualmente
   * pelo botão de Configurações), reaproveita a mesma em vez de iniciar outra
   * em paralelo — duas buscas simultâneas na wishlist inteira dobram o
   * consumo de cota do GG.deals ao mesmo tempo, fazendo o rate limit (100/min,
   * 1000/hora) ser atingido bem mais rápido e prolongando a espera de todo
   * mundo, em vez de só uma das duas.
   */
  private runTick(): Promise<void> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.onTick()
      .catch((error) => {
        logger.error('Falha no polling de ofertas', error)
      })
      .finally(() => {
        this.inFlight = null
      })

    return this.inFlight
  }
}
