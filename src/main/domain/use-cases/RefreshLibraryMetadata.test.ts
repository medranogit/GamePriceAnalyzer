import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata, OwnedGame } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { RefreshLibraryMetadata } from './RefreshLibraryMetadata'

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

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn(), removeEvents: vi.fn() }
}

function makeOwnedGame(appId: number): OwnedGame {
  return { appId, name: `Game ${appId}`, playtimeForeverMinutes: 0 }
}

function makeMetadata(appId: number): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
    genres: ['RPG'],
    headerImageUrl: `https://example.com/${appId}.jpg`,
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
    dlcAppIds: [],
    isDlc: false,
    parentAppId: null
  }
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  const metadataStore = new Map<number, GameMetadata>()
  let deals: GameDeal[] = []
  let pendingLibraryRefreshAppIds: number[] = []
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
    getMetadata: (appId) => metadataStore.get(appId) ?? null,
    setMetadata: vi.fn((metadata) => {
      metadataStore.set(metadata.appId, metadata)
    }),
    getAllMetadata: () => [...metadataStore.values()],
    getPendingDealsAppIds: () => [],
    setPendingDealsAppIds: vi.fn(),
    getPendingLibraryRefreshAppIds: () => pendingLibraryRefreshAppIds,
    setPendingLibraryRefreshAppIds: vi.fn((next: number[]) => {
      pendingLibraryRefreshAppIds = next
    }),
    getManuallyOwnedDlcAppIds: () => [],
    setManuallyOwnedDlcAppIds: vi.fn(),
    ...overrides
  }
}

describe('RefreshLibraryMetadata', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconfere TODOS os jogos da biblioteca, mesmo quem já tem metadata completa em cache', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1), makeOwnedGame(2)],
      getMetadata: (appId) => makeMetadata(appId)
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const historyRepository = makeHistoryRepository()
    const useCase = new RefreshLibraryMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      historyRepository
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(1)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(result.refreshed).toBe(2)
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'metadata_refresh',
      expect.stringContaining('Metadata sobrescrita'),
      1
    )
  })

  it('sobrescreve capa/sinopse antigas na oferta cacheada com o valor mais recente da Steam', async () => {
    vi.useFakeTimers()
    const cachedDeal: GameDeal = {
      appId: 1,
      title: 'Game 1',
      genres: [],
      ggDealsUrl: '',
      currency: 'BRL',
      currentRetailPrice: null,
      currentKeyshopPrice: null,
      historicalRetailLow: null,
      historicalKeyshopLow: null,
      steamPrice: null,
      steamDiscountPercent: null,
      steamFullPrice: null,
      shortDescription: 'Sinopse velha',
      developers: [],
      publishers: [],
      releaseDate: null,
      metacriticScore: null,
      recommendationsTotal: null,
      screenshots: [],
      trailers: [],
      coverUrl: 'https://example.com/old.jpg',
      firstSeenAt: new Date().toISOString()
    }
    const freshMetadata: GameMetadata = {
      ...makeMetadata(1),
      headerImageUrl: 'https://example.com/new.jpg',
      shortDescription: 'Sinopse nova'
    }
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1)]
    })
    cacheRepository.setDeals([cachedDeal])
    const fetchMetadata = vi.fn(async () => freshMetadata)
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new RefreshLibraryMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      makeHistoryRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    await resultPromise

    const [updatedDeal] = cacheRepository.getDeals()
    expect(updatedDeal.coverUrl).toBe('https://example.com/new.jpg')
    expect(updatedDeal.shortDescription).toBe('Sinopse nova')
  })

  it('cancel() para assim que possível e retoma de onde parou na próxima execução', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1), makeOwnedGame(2), makeOwnedGame(3)]
    })
    let useCase!: RefreshLibraryMetadata
    const fetchMetadata = vi.fn(async (appId: number) => {
      if (appId === 1) useCase.cancel()
      return makeMetadata(appId)
    })
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    useCase = new RefreshLibraryMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      makeHistoryRepository()
    )

    const firstRunPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const firstResult = await firstRunPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(firstResult.refreshed).toBe(1)
    expect(cacheRepository.getPendingLibraryRefreshAppIds()).toEqual([2, 3])

    fetchMetadata.mockClear()
    const secondRunPromise = useCase.execute()
    await vi.runAllTimersAsync()
    await secondRunPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(fetchMetadata).toHaveBeenCalledWith(3)
    expect(cacheRepository.getPendingLibraryRefreshAppIds()).toEqual([])
  })

  it('não deixa uma segunda chamada rodar em paralelo com uma já em andamento', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1)]
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new RefreshLibraryMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      makeHistoryRepository()
    )

    const first = useCase.execute()
    const second = useCase.execute()
    await vi.runAllTimersAsync()
    await Promise.all([first, second])

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
  })
})
