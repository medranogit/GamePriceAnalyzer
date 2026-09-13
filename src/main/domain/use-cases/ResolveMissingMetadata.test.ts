import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { ResolveMissingMetadata } from './ResolveMissingMetadata'

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

function makeMetadata(appId: number): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
    genres: [],
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
    trailers: []
  }
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
    trailers: [],
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  const metadataStore = new Map<number, GameMetadata>()
  return {
    getOwnedGames: () => [],
    setOwnedGames: vi.fn(),
    getWishlist: () => [],
    setWishlist: vi.fn(),
    getDeals: () => [],
    setDeals: vi.fn(),
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

describe('ResolveMissingMetadata', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('só busca metadata de quem ainda não está em cache', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)],
      getMetadata: (appId) => (appId === 1 ? makeMetadata(1) : null)
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(cacheRepository.setMetadata).toHaveBeenCalledWith(makeMetadata(2))
    expect(result).toEqual({ resolved: 1, failed: 0, synced: 0 })
  })

  it('também busca metadata de jogos possuídos (biblioteca), não só da wishlist, sem duplicar quem está nas duas listas', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(3)],
      getOwnedGames: () => [makeOwnedGame(2), makeOwnedGame(3)],
      getMetadata: (appId) => (appId === 1 ? makeMetadata(1) : null)
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(fetchMetadata).toHaveBeenCalledWith(3)
    expect(result.resolved).toBe(2)
  })

  it('com scope "library", ignora a wishlist e resolve só quem está na biblioteca (jogos possuídos)', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1)],
      getOwnedGames: () => [makeOwnedGame(2)]
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute('library')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(2)
    expect(result.resolved).toBe(1)
  })

  it.each(['shortDescription', 'headerImageUrl', 'steamFullPrice'] as const)(
    'busca de novo quando a metadata em cache é de uma versão anterior e não tem o campo "%s"',
    async (missingField) => {
      vi.useFakeTimers()
      const legacyMetadata = { ...makeMetadata(1) } as Partial<GameMetadata>
      delete legacyMetadata[missingField]
      const cacheRepository = makeCacheRepository({
        getWishlist: () => [makeWishlistItem(1)],
        getMetadata: () => legacyMetadata as GameMetadata
      })
      const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
      const metadataRepository: GameMetadataRepository = { fetchMetadata }
      const useCase = new ResolveMissingMetadata(
        cacheRepository,
        metadataRepository,
        makeSessionLogRepository()
      )

      const resultPromise = useCase.execute()
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(fetchMetadata).toHaveBeenCalledWith(1)
      expect(result.resolved).toBe(1)
    }
  )

  it('conta falha quando a Steam não devolve metadata, sem travar o restante', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)]
    })
    const fetchMetadata = vi
      .fn<GameMetadataRepository['fetchMetadata']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeMetadata(2))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toEqual({ resolved: 1, failed: 1, synced: 0 })
  })

  it('sincroniza capa em ofertas cacheadas mesmo pra metadata que já estava em cache antes desta execução', async () => {
    vi.useFakeTimers()
    const metadata = makeMetadata(5)
    const cachedDeal = makeDeal(5, { coverUrl: undefined, genres: [] })
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(5)],
      getMetadata: (appId) => (appId === 5 ? metadata : null),
      getDeals: () => [cachedDeal]
    })
    const fetchMetadata = vi.fn()
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).not.toHaveBeenCalled()
    expect(cacheRepository.setDeals).toHaveBeenCalledWith([
      expect.objectContaining({ appId: 5, coverUrl: metadata.headerImageUrl })
    ])
    expect(result.synced).toBe(1)
  })

  it('atualiza capa/gênero em ofertas já cacheadas (Dashboard e Wishlist), sem esperar a próxima busca completa', async () => {
    vi.useFakeTimers()
    const cachedDeal = makeDeal(2, { coverUrl: undefined, genres: [] })
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)],
      getDeals: () => [cachedDeal],
      getWishlistDeals: () => [cachedDeal]
    })
    const metadata = makeMetadata(2)
    const fetchMetadata = vi.fn(async () => metadata)
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    await resultPromise

    expect(cacheRepository.setDeals).toHaveBeenCalledWith([
      expect.objectContaining({ appId: 2, coverUrl: metadata.headerImageUrl })
    ])
    expect(cacheRepository.setWishlistDeals).toHaveBeenCalledWith([
      expect.objectContaining({ appId: 2, coverUrl: metadata.headerImageUrl })
    ])
  })

  it('não quebra ao sincronizar oferta/metadata cacheadas por uma versão anterior, sem developers/publishers/screenshots', async () => {
    vi.useFakeTimers()
    const legacyMetadata = { ...makeMetadata(7) } as Partial<GameMetadata>
    delete legacyMetadata.developers
    delete legacyMetadata.publishers
    delete legacyMetadata.screenshots
    const legacyDeal = { ...makeDeal(7) } as Partial<GameDeal>
    delete legacyDeal.developers
    delete legacyDeal.publishers
    delete legacyDeal.screenshots
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(7)],
      getMetadata: (appId) => (appId === 7 ? (legacyMetadata as GameMetadata) : null),
      getDeals: () => [legacyDeal as GameDeal]
    })
    const fetchMetadata = vi.fn(async () => null)
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    await resultPromise

    expect(cacheRepository.setDeals).toHaveBeenCalledWith([
      expect.objectContaining({ appId: 7, developers: [], publishers: [], screenshots: [] })
    ])
  })

  it('cancel() para a resolução assim que possível, sem processar o restante da fila', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2), makeWishlistItem(3)]
    })
    let useCase!: ResolveMissingMetadata
    const fetchMetadata = vi.fn(async (appId: number) => {
      if (appId === 1) useCase.cancel()
      return makeMetadata(appId)
    })
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    useCase = new ResolveMissingMetadata(cacheRepository, metadataRepository, makeSessionLogRepository())

    const resultPromise = useCase.execute()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(1)
    expect(result).toEqual({ resolved: 1, failed: 0, synced: 0 })
  })

  it('isResolving() reflete o estado real mesmo sem ninguém segurando a Promise de execute() (ex: trocou de aba e voltou)', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1)]
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    expect(useCase.isResolving()).toBe(false)

    const resultPromise = useCase.execute()
    expect(useCase.isResolving()).toBe(true)

    await vi.runAllTimersAsync()
    await resultPromise

    expect(useCase.isResolving()).toBe(false)
  })

  it('não deixa uma segunda chamada rodar em paralelo com uma já em andamento', async () => {
    vi.useFakeTimers()
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1)]
    })
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const metadataRepository: GameMetadataRepository = { fetchMetadata }
    const useCase = new ResolveMissingMetadata(
      cacheRepository,
      metadataRepository,
      makeSessionLogRepository()
    )

    const first = useCase.execute()
    const second = useCase.execute()
    await vi.runAllTimersAsync()
    await Promise.all([first, second])

    expect(fetchMetadata).toHaveBeenCalledTimes(1)
  })
})
