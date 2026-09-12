import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameMetadata, WishlistItem } from '@shared/types'
import type { SteamWishlistRepository } from '../repositories/SteamWishlistRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { SyncSteamWishlist } from './SyncSteamWishlist'

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
    getPendingDealsAppIds: () => [],
    setPendingDealsAppIds: vi.fn(),
    ...overrides
  }
}

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn() }
}

describe('SyncSteamWishlist', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reaproveita item já existente no cache sem buscar metadata de novo', async () => {
    const existing: WishlistItem = {
      appId: 730,
      title: 'Counter-Strike 2',
      storeUrl: 'https://store.steampowered.com/app/730/',
      addedDate: '2026-01-01T00:00:00.000Z',
      releaseDate: '2012-08-21',
      currentPrice: null,
      discountPercent: 0,
      reviewCount: 100,
      reviewPositivePercent: 90
    }
    const steamWishlistRepository: SteamWishlistRepository = {
      fetchWishlistAppIds: vi.fn(async () => [{ appId: 730, addedAt: '2026-02-01T00:00:00.000Z' }])
    }
    const fetchMetadata = vi.fn()
    const cacheRepository = makeCacheRepository({ getWishlist: () => [existing] })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncSteamWishlist(
      steamWishlistRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    const result = await useCase.execute('76561198000000000')

    expect(fetchMetadata).not.toHaveBeenCalled()
    expect(result).toEqual([{ ...existing, addedDate: '2026-02-01T00:00:00.000Z' }])
    expect(cacheRepository.setWishlist).toHaveBeenCalledWith(result)
  })

  it('resolve metadata pra AppID novo e respeita a pausa de rate-limit da Steam', async () => {
    vi.useFakeTimers()
    const metadata: GameMetadata = {
      appId: 999,
      title: 'Novo Jogo',
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
    const steamWishlistRepository: SteamWishlistRepository = {
      fetchWishlistAppIds: vi.fn(async () => [{ appId: 999, addedAt: '2026-02-01T00:00:00.000Z' }])
    }
    const fetchMetadata = vi.fn(async () => metadata)
    const cacheRepository = makeCacheRepository()
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncSteamWishlist(
      steamWishlistRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute('76561198000000000')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledWith(999)
    expect(result[0].title).toBe('Novo Jogo')
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'wishlist_import',
      expect.stringContaining('1 jogos (1 novos)')
    )
  })

  it('remove da wishlist local os jogos que não estão mais na wishlist da Steam', async () => {
    const removedItem: WishlistItem = {
      appId: 1,
      title: 'Jogo removido',
      storeUrl: 'https://store.steampowered.com/app/1/',
      addedDate: '2026-01-01T00:00:00.000Z',
      releaseDate: '',
      currentPrice: null,
      discountPercent: 0,
      reviewCount: 0,
      reviewPositivePercent: 0
    }
    const steamWishlistRepository: SteamWishlistRepository = {
      fetchWishlistAppIds: vi.fn(async () => [])
    }
    const cacheRepository = makeCacheRepository({ getWishlist: () => [removedItem] })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncSteamWishlist(
      steamWishlistRepository,
      { fetchMetadata: vi.fn() },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    const result = await useCase.execute('76561198000000000')

    expect(result).toEqual([])
    expect(cacheRepository.setWishlist).toHaveBeenCalledWith([])
  })

  it('usa metadata já cacheada (por metadata cache) sem chamar o repositório e sem pausa', async () => {
    const metadata: GameMetadata = {
      appId: 999,
      title: 'Já Cacheado',
      genres: [],
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
    const steamWishlistRepository: SteamWishlistRepository = {
      fetchWishlistAppIds: vi.fn(async () => [{ appId: 999, addedAt: '2026-02-01T00:00:00.000Z' }])
    }
    const fetchMetadata = vi.fn()
    const cacheRepository = makeCacheRepository({ getMetadata: (appId) => (appId === 999 ? metadata : null) })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncSteamWishlist(
      steamWishlistRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    const result = await useCase.execute('76561198000000000')

    expect(fetchMetadata).not.toHaveBeenCalled()
    expect(result[0].title).toBe('Já Cacheado')
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'wishlist_import',
      expect.stringContaining('1 jogos (0 novos)')
    )
  })
})
