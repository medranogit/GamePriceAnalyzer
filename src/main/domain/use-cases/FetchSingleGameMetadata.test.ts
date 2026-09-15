import { describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { SingleGameFetchProgressTracker } from '../SingleGameFetchProgressTracker'
import { FetchSingleGameMetadata } from './FetchSingleGameMetadata'

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

function makeMetadata(appId: number, overrides: Partial<GameMetadata> = {}): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
    genres: ['RPG'],
    headerImageUrl: 'https://example.com/new-cover.jpg',
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: 'Sinopse nova.',
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    trailers: [],
    dlcAppIds: [],
    isDlc: false,
    parentAppId: null,
    ...overrides
  }
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  const metadataStore = new Map<number, GameMetadata>()
  let deals: GameDeal[] = []
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
    getPendingLibraryRefreshAppIds: () => [],
    setPendingLibraryRefreshAppIds: vi.fn(),
    getManuallyOwnedDlcAppIds: () => [],
    setManuallyOwnedDlcAppIds: vi.fn(),
    ...overrides
  }
}

describe('FetchSingleGameMetadata', () => {
  it('busca a metadata de um único appId e salva no cache', async () => {
    const cacheRepository = makeCacheRepository()
    const fetchMetadata = vi.fn(async () => makeMetadata(1))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      new SingleGameFetchProgressTracker()
    )

    const result = await useCase.execute(1)

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(1, 'manual')
    expect(result?.title).toBe('Game 1')
    expect(cacheRepository.getMetadata(1)).toEqual(makeMetadata(1))
  })

  it('sobrescreve capa/sinopse já cacheadas na oferta com o valor mais recente da Steam', async () => {
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
      shortDescription: 'Sinopse antiga',
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
    const cacheRepository = makeCacheRepository()
    cacheRepository.setDeals([cachedDeal])
    const fetchMetadata = vi.fn(async () => makeMetadata(1))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      new SingleGameFetchProgressTracker()
    )

    await useCase.execute(1)

    const [updatedDeal] = cacheRepository.getDeals()
    expect(updatedDeal.coverUrl).toBe('https://example.com/new-cover.jpg')
    expect(updatedDeal.shortDescription).toBe('Sinopse nova.')
  })

  it('não dispara uma segunda busca pro mesmo AppID enquanto a primeira ainda está rodando', async () => {
    const cacheRepository = makeCacheRepository()
    let resolveFetch: (metadata: GameMetadata) => void = () => {}
    const fetchMetadata = vi.fn(
      () =>
        new Promise<GameMetadata>((resolve) => {
          resolveFetch = resolve
        })
    )
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      new SingleGameFetchProgressTracker()
    )

    const first = useCase.execute(1)
    const second = useCase.execute(1)
    resolveFetch(makeMetadata(1))
    await Promise.all([first, second])

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
  })

  it('permite buscas simultâneas pra AppIDs diferentes', async () => {
    const cacheRepository = makeCacheRepository()
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      new SingleGameFetchProgressTracker()
    )

    await Promise.all([useCase.execute(1), useCase.execute(2)])

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
  })

  it('retorna null e não mexe no cache quando a Steam não devolve metadata', async () => {
    const cacheRepository = makeCacheRepository()
    const fetchMetadata = vi.fn(async () => null)
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository(),
      new SingleGameFetchProgressTracker()
    )

    const result = await useCase.execute(1)

    expect(result).toBeNull()
    expect(cacheRepository.setMetadata).not.toHaveBeenCalled()
  })
})
