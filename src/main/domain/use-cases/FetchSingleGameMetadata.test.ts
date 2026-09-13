import { describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
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
    trailerUrl: null,
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
      makeSessionLogRepository()
    )

    const result = await useCase.execute(1)

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(1)
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
      trailerUrl: null,
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
      makeSessionLogRepository()
    )

    await useCase.execute(1)

    const [updatedDeal] = cacheRepository.getDeals()
    expect(updatedDeal.coverUrl).toBe('https://example.com/new-cover.jpg')
    expect(updatedDeal.shortDescription).toBe('Sinopse nova.')
  })

  it('retorna null e não mexe no cache quando a Steam não devolve metadata', async () => {
    const cacheRepository = makeCacheRepository()
    const fetchMetadata = vi.fn(async () => null)
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new FetchSingleGameMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const result = await useCase.execute(1)

    expect(result).toBeNull()
    expect(cacheRepository.setMetadata).not.toHaveBeenCalled()
  })
})
