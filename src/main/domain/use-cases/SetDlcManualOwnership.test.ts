import { describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import { SetDlcManualOwnership } from './SetDlcManualOwnership'

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn(), removeEvents: vi.fn() }
}

function makeDeal(appId: number): GameDeal {
  return {
    appId,
    title: `DLC ${appId}`,
    genres: [],
    ggDealsUrl: `https://gg.deals/game/${appId}/`,
    currency: 'BRL',
    currentRetailPrice: 50,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: null,
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    trailers: [],
    firstSeenAt: new Date().toISOString()
  }
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  let deals: GameDeal[] = []
  let manuallyOwned: number[] = []
  return {
    getOwnedGames: () => [],
    setOwnedGames: vi.fn(),
    getWishlist: () => [],
    setWishlist: vi.fn(),
    getDeals: () => deals,
    setDeals: vi.fn((next: GameDeal[]) => {
      deals = next
    }),
    getWishlistDeals: () => [],
    setWishlistDeals: vi.fn(),
    getMetadata: () => null as GameMetadata | null,
    setMetadata: vi.fn(),
    getAllMetadata: () => [],
    getPendingDealsAppIds: () => [],
    setPendingDealsAppIds: vi.fn(),
    getPendingLibraryRefreshAppIds: () => [],
    setPendingLibraryRefreshAppIds: vi.fn(),
    getManuallyOwnedDlcAppIds: () => manuallyOwned,
    setManuallyOwnedDlcAppIds: vi.fn((next: number[]) => {
      manuallyOwned = next
    }),
    ...overrides
  }
}

describe('SetDlcManualOwnership', () => {
  it('marca uma DLC como possuída e remove a oferta cacheada dela na hora', () => {
    const cacheRepository = makeCacheRepository()
    const otherDeal = makeDeal(200)
    cacheRepository.setDeals([makeDeal(100), otherDeal])
    const useCase = new SetDlcManualOwnership(cacheRepository, makeHistoryRepository())

    const result = useCase.execute(100, true)

    expect(result).toEqual([100])
    expect(cacheRepository.getDeals()).toEqual([otherDeal])
  })

  it('desmarca uma DLC (não mexe nas ofertas, só tira da lista de possuídas manualmente)', () => {
    const cacheRepository = makeCacheRepository()
    cacheRepository.setManuallyOwnedDlcAppIds([100, 200])
    const useCase = new SetDlcManualOwnership(cacheRepository, makeHistoryRepository())

    const result = useCase.execute(100, false)

    expect(result).toEqual([200])
  })

  it('registra um evento de histórico só quando o estado realmente muda', () => {
    const cacheRepository = makeCacheRepository()
    cacheRepository.setManuallyOwnedDlcAppIds([100])
    const historyRepository = makeHistoryRepository()
    const useCase = new SetDlcManualOwnership(cacheRepository, historyRepository)

    useCase.execute(100, true)

    expect(historyRepository.addEvent).not.toHaveBeenCalled()
  })
})
