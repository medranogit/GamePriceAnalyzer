import { Notification, type BrowserWindow } from 'electron'
import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice } from '@shared/dealPricing'
import type { NotificationService } from '../../domain/use-cases/CheckDealAlerts'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { logger } from '../logging/logger'

function isWithinQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false

  const now = new Date()
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  return startMinutes <= endMinutes
    ? nowMinutes >= startMinutes && nowMinutes < endMinutes
    : nowMinutes >= startMinutes || nowMinutes < endMinutes // atravessa a meia-noite
}

/**
 * Dispara notificação nativa do SO e avisa a janela (se aberta) para tocar o
 * som customizado e atualizar a lista de ofertas em tempo real.
 */
export class ElectronNotificationService implements NotificationService {
  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly settingsRepository: SettingsRepository
  ) {}

  notifyDeal(deal: GameDeal): void {
    const { quietHoursStart, quietHoursEnd } = this.settingsRepository.get().polling
    if (isWithinQuietHours(quietHoursStart, quietHoursEnd)) {
      logger.info(`Notificação de ${deal.title} suprimida (quiet hours).`)
      return
    }

    const best = getBestCurrentPrice(deal)
    const priceText = best ? `${deal.currency} ${best.price.toFixed(2)} (${best.label})` : 'oferta encontrada'
    const discountText = deal.steamDiscountPercent ? ` (-${deal.steamDiscountPercent}%)` : ''

    new Notification({
      title: deal.title,
      body: `${priceText}${discountText}`,
      silent: false
    }).show()

    this.getMainWindow()?.webContents.send(IPC_CHANNELS.dealsFoundEvent, deal)
  }
}
