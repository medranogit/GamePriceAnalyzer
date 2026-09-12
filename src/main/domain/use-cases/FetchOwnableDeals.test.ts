import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { FetchOwnableDeals } from './FetchOwnableDeals'

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

function makeWishlistItem(appId: number): WishlistItem {
  return {
    appId,
    title: `Game ${appId}`,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    addedDate: new Date().toISOString(),
    releaseDate: '',
    currentPrice: null,
    discountPercent: 0,
    reviewCount: 0,
    reviewPositivePercent: 0
  }
}

function makeOwnedGame(appId: number): OwnedGame {
  return { appId, name: `Game ${appId}`, playtimeForeverMinutes: 0 }
}

function makeDeal(appId: number, overrides: Partial<GameDeal> = {}): GameDeal {
  return {
    appId,
    title: `Game ${appId}`,
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
    trailerUrl: null,
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  return {
    getOwnedGames: () => [],
    setOwnedGames: vi.fn(),
    getWishlist: () => [],
    setWishlist: vi.fn(),
    getDeals: () => [],
    setDeals: vi.fn(),
    getWishlistDeals: () => [],
    setWishlistDeals: vi.fn(),
    getMetadata: () => null,
    setMetadata: vi.fn(),
    getAllMetadata: () => [],
    ...overrides
  }
}

describe('FetchOwnableDeals', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('não consulta a API quando não há candidatos na wishlist', async () => {
    const fetchDealsBySteamAppIds = vi.fn()
    const cacheRepository = makeCacheRepository({ getWishlist: () => [] })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn() },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository()
    )

    const result = await useCase.execute()

    expect(result).toEqual([])
    expect(fetchDealsBySteamAppIds).not.toHaveBeenCalled()
  })

  it('descarta jogos já possuídos antes de consultar o GG.deals', async () => {
    vi.useFakeTimers()
    const fetchDealsBySteamAppIds: DealsRepository['fetchDealsBySteamAppIds'] = vi.fn(
      async (appIds: number[]) => appIds.map((appId) => makeDeal(appId))
    )
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)],
      getOwnedGames: () => [makeOwnedGame(1)]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    await resultPromise

    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([2])
  })

  it('registra observação de preço e enriquece com metadata para cada oferta', async () => {
    vi.useFakeTimers()
    const recordObservation = vi.fn()
    const metadata: GameMetadata = {
      appId: 2,
      title: 'Game 2',
      genres: ['RPG'],
      headerImageUrl: 'https://example.com/cover.jpg',
      steamPrice: 99.9,
      steamDiscountPercent: 40,
      steamFullPrice: 99.9,
      shortDescription: null,
      developers: [],
      publishers: [],
      releaseDate: null,
      metacriticScore: null,
      recommendationsTotal: null,
      screenshots: [],
      trailerUrl: null
    }
    const fetchDealsBySteamAppIds: DealsRepository['fetchDealsBySteamAppIds'] = vi.fn(async () => [
      makeDeal(2, { currentRetailPrice: 60, currentKeyshopPrice: 55 })
    ])
    const cacheRepository = makeCacheRepository({ getWishlist: () => [makeWishlistItem(2)] })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => metadata) },
      { getRecord: vi.fn(), recordObservation },
      cacheRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(recordObservation).toHaveBeenCalledWith(2, 'BRL', 60, 55)
    expect(result[0].genres).toEqual(['RPG'])
    expect(result[0].coverUrl).toBe('https://example.com/cover.jpg')
    expect(result[0].steamPrice).toBe(99.9)
    expect(result[0].steamDiscountPercent).toBe(40)
    expect(cacheRepository.setDeals).toHaveBeenCalledWith(result)
  })

  it('busca metadata pra cada AppID novo sem cache, sem se preocupar com o ritmo (isso é responsabilidade do GameMetadataRepository injetado)', async () => {
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds: DealsRepository['fetchDealsBySteamAppIds'] = vi.fn(async () => [
      makeDeal(1),
      makeDeal(2)
    ])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(1)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
  })

  it('reaproveita metadata já cacheada sem chamar o repositório de novo', async () => {
    const metadata: GameMetadata = {
      appId: 2,
      title: 'Game 2',
      genres: ['Ação'],
      headerImageUrl: null,
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
      trailerUrl: null
    }
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds: DealsRepository['fetchDealsBySteamAppIds'] = vi.fn(async () => [
      makeDeal(2)
    ])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)],
      getMetadata: (appId) => (appId === 2 ? metadata : null)
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).not.toHaveBeenCalled()
  })
})
