import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameDeal } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'

const { NotificationMock, nativeImageMock } = vi.hoisted(() => {
  class NotificationMock {
    static instances: NotificationMock[] = []

    title: string
    body: string
    icon?: unknown
    silent: boolean
    show = vi.fn()
    private handlers: Record<string, () => void> = {}

    constructor(options: { title: string; body: string; icon?: unknown; silent: boolean }) {
      this.title = options.title
      this.body = options.body
      this.icon = options.icon
      this.silent = options.silent
      NotificationMock.instances.push(this)
    }

    on(event: string, handler: () => void): void {
      this.handlers[event] = handler
    }

    emit(event: string): void {
      this.handlers[event]?.()
    }
  }

  const nativeImageMock = {
    createFromBuffer: vi.fn(() => ({ isEmpty: () => false })),
    createFromPath: vi.fn(() => ({ isEmpty: () => false }))
  }

  return { NotificationMock, nativeImageMock }
})

vi.mock('electron', () => ({
  Notification: NotificationMock,
  nativeImage: nativeImageMock
}))

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../appIcon', () => ({
  getAppIconPath: () => '/fake/icon.png'
}))

const { ElectronNotificationService } = await import('./ElectronNotificationService')

function makeDeal(overrides: Partial<GameDeal> = {}): GameDeal {
  return {
    appId: 730,
    title: 'Counter-Strike 2',
    genres: [],
    ggDealsUrl: 'https://gg.deals/game/counter-strike-2/',
    currency: 'BRL',
    currentRetailPrice: 49.9,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
    steamPrice: 49.9,
    steamDiscountPercent: 50,
    steamFullPrice: null,
    shortDescription: null,
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function makeSettingsRepository(
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): SettingsRepository {
  return {
    get: () =>
      ({
        polling: { intervalMinutes: 30, quietHoursStart, quietHoursEnd }
      }) as ReturnType<SettingsRepository['get']>,
    update: vi.fn()
  }
}

describe('ElectronNotificationService', () => {
  beforeEach(() => {
    NotificationMock.instances.length = 0
    nativeImageMock.createFromBuffer.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('não dispara notificação dentro do horário silencioso', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T23:30:00'))

    const settingsRepository = makeSettingsRepository('22:00', '08:00')
    const service = new ElectronNotificationService(() => null, settingsRepository)

    service.notifyDeal(makeDeal())

    // isWithinQuietHours é síncrono e retorna antes de qualquer await, então
    // não precisa esperar microtask nenhuma pra confirmar que nada disparou.
    expect(NotificationMock.instances).toHaveLength(0)
  })

  it('dispara notificação fora do horário silencioso, com título, preço e desconto formatados', async () => {
    const settingsRepository = makeSettingsRepository(null, null)
    const service = new ElectronNotificationService(() => null, settingsRepository)

    service.notifyDeal(
      makeDeal({ title: 'Elden Ring', currentRetailPrice: 149.5, currency: 'BRL', steamDiscountPercent: 30 })
    )

    await vi.waitFor(() => {
      expect(NotificationMock.instances).toHaveLength(1)
    })

    const notification = NotificationMock.instances[0]
    expect(notification.title).toBe('🎮 Elden Ring')
    expect(notification.body).toBe('BRL 149.50 · Loja oficial (-30%)')
    expect(notification.show).toHaveBeenCalledTimes(1)
  })

  it('clicar na notificação mostra e foca a janela principal, e avisa o renderer', async () => {
    const settingsRepository = makeSettingsRepository(null, null)
    const show = vi.fn()
    const focus = vi.fn()
    const send = vi.fn()
    const getMainWindow = vi.fn(() => ({ show, focus, webContents: { send } }) as never)
    const service = new ElectronNotificationService(getMainWindow, settingsRepository)

    const deal = makeDeal()
    service.notifyDeal(deal)

    await vi.waitFor(() => {
      expect(NotificationMock.instances).toHaveLength(1)
    })

    NotificationMock.instances[0].emit('click')

    expect(show).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.dealsFoundEvent, deal)
  })

  it('sem preço disponível, mostra mensagem genérica', async () => {
    const settingsRepository = makeSettingsRepository(null, null)
    const service = new ElectronNotificationService(() => null, settingsRepository)

    service.notifyDeal(
      makeDeal({ currentRetailPrice: null, currentKeyshopPrice: null, steamDiscountPercent: null })
    )

    await vi.waitFor(() => {
      expect(NotificationMock.instances).toHaveLength(1)
    })

    expect(NotificationMock.instances[0].body).toBe('Oferta encontrada')
  })
})
