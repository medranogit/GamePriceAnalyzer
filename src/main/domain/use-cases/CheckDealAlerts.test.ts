import { describe, expect, it, vi } from 'vitest'
import type { GameDeal } from '@shared/types'
import type { FetchOwnableDeals } from './FetchOwnableDeals'
import type { NotifiedDealsRepository } from '../repositories/NotifiedDealsRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { CheckDealAlerts, type NotificationService } from './CheckDealAlerts'

function makeDeal(appId: number, overrides: Partial<GameDeal> = {}): GameDeal {
  return {
    appId,
    title: `Game ${appId}`,
    genres: [],
    ggDealsUrl: `https://gg.deals/game/${appId}/`,
    currency: 'BRL',
    currentRetailPrice: 10,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
    steamPrice: 100,
    steamDiscountPercent: 90,
    steamFullPrice: 100,
    shortDescription: null,
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    trailerUrl: null,
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function makeFetchOwnableDeals(deals: GameDeal[]): FetchOwnableDeals {
  return { execute: vi.fn(async () => deals) } as unknown as FetchOwnableDeals
}

function makeNotifiedDealsRepository(): NotifiedDealsRepository {
  return {
    alreadyNotifiedForPrice: () => false,
    markNotified: vi.fn(),
    clearForAppId: vi.fn(),
    clear: vi.fn()
  }
}

/** Réplica simplificada, em memória, da regra real (ElectronStoreNotifiedDealsRepository) — usada pra
 * testar a sequência completa de notificar/esquecer/renotificar ao longo de várias execuções. */
function makeStatefulNotifiedDealsRepository(): NotifiedDealsRepository {
  const records = new Map<number, number>()
  return {
    alreadyNotifiedForPrice: (appId, price) => {
      const lastNotifiedPrice = records.get(appId)
      return lastNotifiedPrice !== undefined && price >= lastNotifiedPrice
    },
    markNotified: (record) => {
      records.set(record.appId, record.lastNotifiedPrice)
    },
    clearForAppId: (appId) => {
      records.delete(appId)
    },
    clear: () => records.clear()
  }
}

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn() }
}

function makeSettingsRepository(
  notifyMinDiscountPercent = 50,
  notifyOnHistoricalLow = true
): SettingsRepository {
  return {
    get: () =>
      ({
        filters: {},
        polling: {
          quietHoursStart: null,
          quietHoursEnd: null,
          notifyMinDiscountPercent,
          notifyOnHistoricalLow
        }
      }) as ReturnType<SettingsRepository['get']>,
    update: vi.fn()
  }
}

function makeSessionLogRepository(): SessionLogRepository {
  return {
    startSession: vi.fn(() => 'session-id'),
    log: vi.fn(),
    endSession: vi.fn(),
    listSessions: () => [],
    getEntries: () => [],
    deleteSession: vi.fn()
  }
}

function makeNotificationService(): NotificationService {
  return { notifyDeal: vi.fn(), notifyDealsBatch: vi.fn(), dismissAll: vi.fn() }
}

describe('CheckDealAlerts', () => {
  it('notifica cada oferta individualmente quando poucas qualificam no mesmo ciclo', async () => {
    const deals = [makeDeal(1), makeDeal(2), makeDeal(3)]
    const notificationService = makeNotificationService()
    const historyRepository = makeHistoryRepository()
    const useCase = new CheckDealAlerts(
      makeFetchOwnableDeals(deals),
      makeNotifiedDealsRepository(),
      notificationService,
      historyRepository,
      makeSettingsRepository(),
      makeSessionLogRepository()
    )

    const result = await useCase.execute()

    expect(notificationService.notifyDeal).toHaveBeenCalledTimes(3)
    expect(notificationService.notifyDealsBatch).not.toHaveBeenCalled()
    expect(historyRepository.addEvent).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(3)
  })

  it('agrupa numa notificação única quando muitas ofertas qualificam no mesmo ciclo (evita inundar o SO)', async () => {
    const deals = Array.from({ length: 20 }, (_, i) => makeDeal(i + 1))
    const notificationService = makeNotificationService()
    const notifiedDealsRepository = makeNotifiedDealsRepository()
    const useCase = new CheckDealAlerts(
      makeFetchOwnableDeals(deals),
      notifiedDealsRepository,
      notificationService,
      makeHistoryRepository(),
      makeSettingsRepository(),
      makeSessionLogRepository()
    )

    const result = await useCase.execute()

    expect(notificationService.notifyDeal).not.toHaveBeenCalled()
    expect(notificationService.notifyDealsBatch).toHaveBeenCalledTimes(1)
    expect(notificationService.notifyDealsBatch).toHaveBeenCalledWith(deals)
    // mesmo em lote, cada uma ainda é marcada como notificada (não notifica de novo no próximo ciclo)
    expect(notifiedDealsRepository.markNotified).toHaveBeenCalledTimes(20)
    expect(result).toHaveLength(20)
  })

  it('não notifica de novo o mesmo appId no mesmo preço', async () => {
    const deals = [makeDeal(1)]
    const notificationService = makeNotificationService()
    const notifiedDealsRepository: NotifiedDealsRepository = {
      alreadyNotifiedForPrice: () => true,
      markNotified: vi.fn(),
      clearForAppId: vi.fn(),
      clear: vi.fn()
    }
    const useCase = new CheckDealAlerts(
      makeFetchOwnableDeals(deals),
      notifiedDealsRepository,
      notificationService,
      makeHistoryRepository(),
      makeSettingsRepository(),
      makeSessionLogRepository()
    )

    const result = await useCase.execute()

    expect(notificationService.notifyDeal).not.toHaveBeenCalled()
    expect(notificationService.notifyDealsBatch).not.toHaveBeenCalled()
    expect(result).toHaveLength(0)
  })

  it('notifica de novo quando o desconto volta a qualificar depois de sair da faixa, mesmo que o novo preço não seja o menor já notificado', async () => {
    const notifiedDealsRepository = makeStatefulNotifiedDealsRepository()
    const notificationService = makeNotificationService()
    const fetchDeals = vi.fn()
    const fetchOwnableDeals = { execute: fetchDeals } as unknown as FetchOwnableDeals
    const useCase = new CheckDealAlerts(
      fetchOwnableDeals,
      notifiedDealsRepository,
      notificationService,
      makeHistoryRepository(),
      makeSettingsRepository(50, true),
      makeSessionLogRepository()
    )

    // 1) 80% de desconto (R$20 de um preço cheio de R$100) — qualifica (>= 50%), notifica.
    fetchDeals.mockResolvedValueOnce([
      makeDeal(1, { currentRetailPrice: 20, steamFullPrice: 100, steamDiscountPercent: 80 })
    ])
    await useCase.execute()
    expect(notificationService.notifyDeal).toHaveBeenCalledTimes(1)

    // 2) preço volta ao normal — não qualifica mais, não notifica (e esquece o registro).
    fetchDeals.mockResolvedValueOnce([
      makeDeal(1, { currentRetailPrice: 100, steamFullPrice: 100, steamDiscountPercent: 0 })
    ])
    await useCase.execute()
    expect(notificationService.notifyDeal).toHaveBeenCalledTimes(1)

    // 3) cai de novo, dessa vez a 75% (R$25) — pior que os R$20 de antes, mas é uma nova onda de desconto: notifica de novo.
    fetchDeals.mockResolvedValueOnce([
      makeDeal(1, { currentRetailPrice: 25, steamFullPrice: 100, steamDiscountPercent: 75 })
    ])
    await useCase.execute()
    expect(notificationService.notifyDeal).toHaveBeenCalledTimes(2)
  })
})
