import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
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
    getManuallyOwnedDlcAppIds: () => [],
    setManuallyOwnedDlcAppIds: vi.fn(),
    ...overrides
  }
}

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn(), removeEvents: vi.fn() }
}

function makeOwnedGame(appId: number, name = `Game ${appId}`): OwnedGame {
  return { appId, name, playtimeForeverMinutes: 0 }
}

function makeWishlistItem(appId: number): WishlistItem {
  return {
    appId,
    title: `Game ${appId}`,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    addedDate: '2026-01-01',
    releaseDate: '',
    currentPrice: null,
    discountPercent: 0,
    reviewCount: 0,
    reviewPositivePercent: 0
  }
}

function makeDeal(appId: number | null): GameDeal {
  return {
    appId,
    title: `Game ${appId}`,
    genres: [],
    ggDealsUrl: '',
    currency: null,
    currentRetailPrice: null,
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
    firstSeenAt: '2026-01-01T00:00:00.000Z'
  }
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
    trailers: [],
    dlcAppIds: [],
    isDlc: false,
    parentAppId: null
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
    expect(fetchMetadata).toHaveBeenCalledWith(2, 'biblioteca')
    expect(cacheRepository.setMetadata).toHaveBeenCalledWith(makeMetadata(2))
    // Evento por-jogo com o nome e o appId — usado pela tela de Histórico pra listar
    // individualmente quem entrou na biblioteca, não só o total agregado.
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'library_sync',
      'Novo na biblioteca: "Game 2".',
      2
    )
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

  it('remove jogo recém-comprado da wishlist e das ofertas cacheadas', async () => {
    const steamLibraryRepository: SteamLibraryRepository = {
      fetchOwnedGames: vi.fn(async () => [makeOwnedGame(1), makeOwnedGame(2)])
    }
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1)],
      getWishlist: () => [makeWishlistItem(2), makeWishlistItem(3)],
      getDeals: () => [makeDeal(2), makeDeal(3), makeDeal(null)]
    })
    const historyRepository = makeHistoryRepository()
    const useCase = new SyncLibraryAndResolveNewGames(
      steamLibraryRepository,
      { fetchMetadata },
      cacheRepository,
      historyRepository,
      makeSessionLogRepository()
    )

    await useCase.execute('76561198000000000')

    expect(cacheRepository.setWishlist).toHaveBeenCalledWith([makeWishlistItem(3)])
    expect(cacheRepository.setDeals).toHaveBeenCalledWith([makeDeal(3), makeDeal(null)])
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'library_sync',
      expect.stringContaining('Removido da wishlist (1) e das ofertas (1) por já ser possuído.')
    )
  })

  it('não mexe na wishlist/ofertas quando nenhum jogo é novo', async () => {
    const steamLibraryRepository: SteamLibraryRepository = {
      fetchOwnedGames: vi.fn(async () => [makeOwnedGame(1)])
    }
    const cacheRepository = makeCacheRepository({
      getOwnedGames: () => [makeOwnedGame(1)],
      getWishlist: () => [makeWishlistItem(3)],
      getDeals: () => [makeDeal(3)]
    })
    const useCase = new SyncLibraryAndResolveNewGames(
      steamLibraryRepository,
      { fetchMetadata: vi.fn() },
      cacheRepository,
      makeHistoryRepository(),
      makeSessionLogRepository()
    )

    await useCase.execute('76561198000000000')

    expect(cacheRepository.setWishlist).not.toHaveBeenCalled()
    expect(cacheRepository.setDeals).not.toHaveBeenCalled()
  })
})
