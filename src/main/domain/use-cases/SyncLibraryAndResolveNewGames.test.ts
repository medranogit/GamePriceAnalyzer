import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameMetadata, OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../repositories/SteamLibraryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { SyncLibraryAndResolveNewGames } from './SyncLibraryAndResolveNewGames'

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
    getPendingLibraryRefreshAppIds: () => [],
    setPendingLibraryRefreshAppIds: vi.fn(),
    ...overrides
  }
}

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn() }
}

function makeOwnedGame(appId: number, name = `Game ${appId}`): OwnedGame {
  return { appId, name, playtimeForeverMinutes: 0 }
}

function makeMetadata(appId: number): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
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
    trailers: []
  }
}

describe('SyncLibraryAndResolveNewGames', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('busca metadata só de jogos novos (que não estavam na biblioteca cacheada antes)', async () => {
    const steamLibraryRepository: SteamLibraryRepository = {
      fetchOwnedGames: vi.fn(async () => [makeOwnedGame(1), makeOwnedGame(2)])
    }
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const cacheRepository = makeCacheRepository({ getOwnedGames: () => [makeOwnedGame(1)] })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncLibraryAndResolveNewGames(
      steamLibraryRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    await useCase.execute('76561198000000000')

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(cacheRepository.setMetadata).toHaveBeenCalledWith(makeMetadata(2))
  })

  it('não busca metadata quando nenhum jogo é novo', async () => {
    const steamLibraryRepository: SteamLibraryRepository = {
      fetchOwnedGames: vi.fn(async () => [makeOwnedGame(1)])
    }
    const fetchMetadata = vi.fn()
    const cacheRepository = makeCacheRepository({ getOwnedGames: () => [makeOwnedGame(1)] })
    const useCase = new SyncLibraryAndResolveNewGames(
      steamLibraryRepository,
      { fetchMetadata },
      cacheRepository,
      makeHistoryRepository(),
      makeSessionLogRepository()
    )

    await useCase.execute('76561198000000000')

    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('registra no histórico quantos jogos são novos', async () => {
    const steamLibraryRepository: SteamLibraryRepository = {
      fetchOwnedGames: vi.fn(async () => [makeOwnedGame(1), makeOwnedGame(2), makeOwnedGame(3)])
    }
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const cacheRepository = makeCacheRepository({ getOwnedGames: () => [makeOwnedGame(1)] })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncLibraryAndResolveNewGames(
      steamLibraryRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    await useCase.execute('76561198000000000')

    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'library_sync',
      expect.stringContaining('3 jogos (2 novo(s))')
    )
  })
})
