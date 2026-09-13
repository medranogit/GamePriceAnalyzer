import { Notification, nativeImage, type BrowserWindow } from 'electron'
import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice, getDisplayDiscountPercent } from '@shared/dealPricing'
import type { NotificationService } from '../../domain/use-cases/CheckDealAlerts'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { logger } from '../logging/logger'
import { getAppIconPath } from '../appIcon'

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

async function fetchIcon(url: string | undefined): Promise<Electron.NativeImage | undefined> {
  if (!url) return undefined
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const buffer = Buffer.from(await res.arrayBuffer())
    const image = nativeImage.createFromBuffer(buffer)
    return image.isEmpty() ? undefined : image
  } catch (error) {
    logger.warn(`Falha ao baixar capa para notificação: ${url}`, error)
    return undefined
  }
}

/**
 * Dispara notificação nativa do SO (com a capa do jogo como ícone) e avisa a
 * janela (se aberta) para tocar o som customizado e atualizar a lista de
 * ofertas em tempo real. Clicar na notificação traz o app pra frente.
 */
export class ElectronNotificationService implements NotificationService {
  private readonly activeNotifications = new Set<Notification>()

  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly settingsRepository: SettingsRepository
  ) {}

  dismissAll(): void {
    for (const notification of this.activeNotifications) {
      notification.close()
    }
    this.activeNotifications.clear()
  }

  private trackNotification(notification: Notification): void {
    this.activeNotifications.add(notification)
    notification.on('close', () => this.activeNotifications.delete(notification))
  }

  notifyDeal(deal: GameDeal): void {
    const { quietHoursStart, quietHoursEnd } = this.settingsRepository.get().polling
    if (isWithinQuietHours(quietHoursStart, quietHoursEnd)) {
      logger.info(`Notificação de ${deal.title} suprimida (quiet hours).`)
      return
    }

    void this.show(deal)
  }

  notifyDealsBatch(deals: GameDeal[]): void {
    const { quietHoursStart, quietHoursEnd } = this.settingsRepository.get().polling
    if (isWithinQuietHours(quietHoursStart, quietHoursEnd)) {
      logger.info(`Notificação em lote de ${deals.length} oferta(s) suprimida (quiet hours).`)
      return
    }

    this.showBatch(deals)
  }

  private showBatch(deals: GameDeal[]): void {
    const notification = new Notification({
      title: `🎮 ${deals.length} novas ofertas encontradas`,
      body: 'Abra o HubGame Center pra conferir.',
      icon: nativeImage.createFromPath(getAppIconPath()),
      silent: false
    })
    this.trackNotification(notification)

    notification.on('click', () => {
      const window = this.getMainWindow()
      if (!window) return
      window.show()
      window.focus()
    })

    notification.show()

    this.getMainWindow()?.webContents.send(IPC_CHANNELS.dealsBatchFoundEvent, deals)
  }

  private async show(deal: GameDeal): Promise<void> {
    const best = getBestCurrentPrice(deal)
    const priceText = best ? `${deal.currency} ${best.price.toFixed(2)} · ${best.label}` : 'Oferta encontrada'
    const displayDiscountPercent = getDisplayDiscountPercent(deal)
    const discountText = displayDiscountPercent > 0 ? ` (-${displayDiscountPercent}%)` : ''

    const icon = (await fetchIcon(deal.coverUrl)) ?? nativeImage.createFromPath(getAppIconPath())

    const notification = new Notification({
      title: `🎮 ${deal.title}`,
      body: `${priceText}${discountText}`,
      icon,
      silent: false
    })
    this.trackNotification(notification)

    notification.on('click', () => {
      const window = this.getMainWindow()
      if (!window) return
      window.show()
      window.focus()
    })

    notification.show()

    this.getMainWindow()?.webContents.send(IPC_CHANNELS.dealsFoundEvent, deal)
  }
}
