import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'
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

function makeHistoryRepository(): HistoryRepository {
  return { getEvents: () => [], addEvent: vi.fn(), removeEvents: vi.fn() }
}

function makeSettingsRepository(
  maxDealsPerCycle = DEFAULT_SETTINGS.polling.maxDealsPerCycle
): SettingsRepository {
  return {
    get: () => ({ ...DEFAULT_SETTINGS, polling: { ...DEFAULT_SETTINGS.polling, maxDealsPerCycle } }),
    update: vi.fn()
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
    trailers: [],
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

/** Simula o GGDealsApiClient real: entrega tudo num lote só, através do onBatch, sem cortar por rate limit. */
function makeFetchDealsBySteamAppIds(
  buildDeals: (appIds: number[]) => GameDeal[]
): DealsRepository['fetchDealsBySteamAppIds'] {
  return vi.fn(
    async (
      appIds: number[],
      _batchSize: number,
      onBatch?: (deals: GameDeal[], requestedAppIds: number[]) => Promise<void> | void
    ) => {
      const deals = buildDeals(appIds)
      await onBatch?.(deals, appIds)
      return { deals, processedAppIdCount: appIds.length }
    }
  )
}

function makeCacheRepository(overrides: Partial<AppCacheRepository> = {}): AppCacheRepository {
  let deals: GameDeal[] = []
  let pendingDealsAppIds: number[] = []
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
    getMetadata: () => null,
    setMetadata: vi.fn(),
    getAllMetadata: () => [],
    getPendingDealsAppIds: () => pendingDealsAppIds,
    setPendingDealsAppIds: vi.fn((next: number[]) => {
      pendingDealsAppIds = next
    }),
    getPendingLibraryRefreshAppIds: () => [],
    setPendingLibraryRefreshAppIds: vi.fn(),
    getManuallyOwnedDlcAppIds: () => [],
    setManuallyOwnedDlcAppIds: vi.fn(),
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
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    const result = await useCase.execute()

    expect(result).toEqual([])
    expect(fetchDealsBySteamAppIds).not.toHaveBeenCalled()
  })

  it('descarta jogos já possuídos antes de consultar o GG.deals', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
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
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([2], expect.any(Number), expect.any(Function))
  })

  it('inclui como candidato a DLC de um jogo já possuído na Biblioteca, mesmo sem estar na wishlist', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
    )
    const ownedGameMetadata: GameMetadata = {
      appId: 1,
      title: 'Jogo base',
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
      dlcAppIds: [100, 200],
      isDlc: false,
      parentAppId: null
    }
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [],
      getOwnedGames: () => [makeOwnedGame(1), makeOwnedGame(200)],
      getAllMetadata: () => [ownedGameMetadata]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    // DLC 100 (não possuída) entra; DLC 200 é descartada por já estar possuída (Set de owned games).
    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([100], expect.any(Number), expect.any(Function))
  })

  it('não inclui como candidato a DLC que o usuário marcou manualmente como possuída', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
    )
    const ownedGameMetadata: GameMetadata = {
      appId: 1,
      title: 'Jogo base',
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
      dlcAppIds: [100, 200],
      isDlc: false,
      parentAppId: null
    }
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [],
      getOwnedGames: () => [makeOwnedGame(1)],
      getAllMetadata: () => [ownedGameMetadata],
      getManuallyOwnedDlcAppIds: () => [100]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([200], expect.any(Number), expect.any(Function))
  })

  it('registra observação de preço e enriquece com metadata para cada oferta', async () => {
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
      trailers: [],
      dlcAppIds: [],
      isDlc: false,
      parentAppId: null
    }
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [
      makeDeal(2, { currentRetailPrice: 60, currentKeyshopPrice: 55 })
    ])
    const cacheRepository = makeCacheRepository({ getWishlist: () => [makeWishlistItem(2)] })
    const historyRepository = makeHistoryRepository()
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => metadata) },
      { getRecord: vi.fn(), recordObservation },
      cacheRepository,
      makeSessionLogRepository(),
      historyRepository,
      makeSettingsRepository()
    )

    const result = await useCase.execute()

    expect(recordObservation).toHaveBeenCalledWith(2, 'BRL', 60, 55)
    expect(result[0].genres).toEqual(['RPG'])
    expect(result[0].coverUrl).toBe('https://example.com/cover.jpg')
    expect(result[0].steamPrice).toBe(99.9)
    expect(result[0].steamDiscountPercent).toBe(40)
    expect(cacheRepository.getDeals()).toEqual(result)
    // Evento por-jogo (oferta genuinamente nova) — usado pela tela de Histórico pra listar
    // individualmente quem entrou em Ofertas, não só o total agregado do ciclo.
    expect(historyRepository.addEvent).toHaveBeenCalledWith('offers_sync', 'Nova oferta: "Game 2".', 2)
  })

  it('busca metadata pra cada AppID novo sem cache, sem se preocupar com o ritmo (isso é responsabilidade do GameMetadataRepository injetado)', async () => {
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [makeDeal(1), makeDeal(2)])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(1, 'ofertas')
    expect(fetchMetadata).toHaveBeenCalledWith(2, 'ofertas')
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
      trailers: [],
      dlcAppIds: [],
      isDlc: false,
      parentAppId: null
    }
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [makeDeal(2)])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)],
      getMetadata: (appId) => (appId === 2 ? metadata : null)
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('busca metadata de novo quando o cache está incompleto (ex: sem trailers, de antes desse campo existir)', async () => {
    const incompleteMetadata = {
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
      screenshots: []
      // trailers ausente de propósito — simula cache de antes desse campo existir
    } as unknown as GameMetadata
    const freshMetadata: GameMetadata = {
      ...incompleteMetadata,
      trailers: [],
      dlcAppIds: [],
      isDlc: false,
      parentAppId: null
    }
    const fetchMetadata = vi.fn(async () => freshMetadata)
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [makeDeal(2)])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)],
      getMetadata: (appId) => (appId === 2 ? incompleteMetadata : null)
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).toHaveBeenCalledWith(2, 'ofertas')
  })

  it('não busca metadata de novo quando o jogo já tem trailers resolvidos como vazio (sem trailer na Steam mesmo)', async () => {
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
      trailers: [],
      dlcAppIds: [],
      isDlc: false,
      parentAppId: null
    }
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [makeDeal(2)])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)],
      getMetadata: (appId) => (appId === 2 ? metadata : null)
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('não busca metadata pra oferta que já existia, mesmo sem nenhuma metadata em cache (só ofertas novas ganham metadata aqui)', async () => {
    const fetchMetadata = vi.fn(async () => null)
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [
      makeDeal(2, { currentRetailPrice: 40 })
    ])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(2)]
    })
    cacheRepository.setDeals([makeDeal(2, { currentRetailPrice: 50 })])
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('retoma uma busca interrompida: pula quem já foi buscado no ciclo anterior e busca só o resto', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
    )
    const previouslyFetchedDeal = makeDeal(1, { currentRetailPrice: 10 })
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2), makeWishlistItem(3)],
      getPendingDealsAppIds: () => [2, 3]
    })
    cacheRepository.setDeals([previouslyFetchedDeal])
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    const result = await useCase.execute()

    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([2, 3], expect.any(Number), expect.any(Function))
    // o appId 1 (já buscado antes da interrupção) continua no resultado final, sem ser buscado de novo
    expect(result.find((deal) => deal.appId === 1)?.currentRetailPrice).toBe(10)
    expect(result).toHaveLength(3)
  })

  it('loga o preço antigo e o novo quando uma oferta já conhecida muda de preço', async () => {
    const sessionLogRepository = makeSessionLogRepository()
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [
      makeDeal(2, { currentRetailPrice: 40, currentKeyshopPrice: 35 })
    ])
    const cacheRepository = makeCacheRepository({ getWishlist: () => [makeWishlistItem(2)] })
    cacheRepository.setDeals([makeDeal(2, { currentRetailPrice: 50, currentKeyshopPrice: 35 })])
    const historyRepository = makeHistoryRepository()
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      sessionLogRepository,
      historyRepository,
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(sessionLogRepository.log).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('loja BRL 50.00 → BRL 40.00')
    )
    expect(historyRepository.addEvent).toHaveBeenCalledWith(
      'offers_sync',
      expect.stringContaining('loja BRL 50.00 → BRL 40.00'),
      2
    )
  })

  it('não loga preço quando a oferta já conhecida não mudou de valor', async () => {
    const sessionLogRepository = makeSessionLogRepository()
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [
      makeDeal(2, { currentRetailPrice: 50, currentKeyshopPrice: 35 })
    ])
    const cacheRepository = makeCacheRepository({ getWishlist: () => [makeWishlistItem(2)] })
    cacheRepository.setDeals([makeDeal(2, { currentRetailPrice: 50, currentKeyshopPrice: 35 })])
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      sessionLogRepository,
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(sessionLogRepository.log).not.toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Preço atualizado')
    )
  })

  it('não fica preso pra sempre em AppIDs que a GG.deals não retorna dado nenhum (regressão real)', async () => {
    // Bug real observado em produção: AppIDs sem dado na resposta do GG.deals nunca saíam de
    // `pendingDealsAppIds` (só quem tinha deal na resposta era removido de lá), travando o ciclo
    // pra sempre nesses AppIDs mortos e nunca mais voltando a consultar o resto da wishlist.
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds(() => [])
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2), makeWishlistItem(3), makeWishlistItem(4)]
    })
    // usa o setter de verdade (não um override fixo) pra getPendingDealsAppIds() continuar refletindo
    // as chamadas de setPendingDealsAppIds feitas durante o execute(), como no cache real.
    cacheRepository.setPendingDealsAppIds([2, 3])
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(cacheRepository.getPendingDealsAppIds()).toEqual([])
  })

  it('respeita o limite configurado de AppIDs por ciclo, deixando o resto pendente pra próxima busca', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
    )
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2), makeWishlistItem(3)]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository(2)
    )

    await useCase.execute()

    expect(fetchDealsBySteamAppIds).toHaveBeenCalledWith([1, 2], expect.any(Number), expect.any(Function))
    expect(cacheRepository.getPendingDealsAppIds()).toEqual([3])
  })

  it('marca todos como pendentes no início de um ciclo novo, e zera ao concluir', async () => {
    const fetchDealsBySteamAppIds = makeFetchDealsBySteamAppIds((appIds) =>
      appIds.map((appId) => makeDeal(appId))
    )
    const cacheRepository = makeCacheRepository({
      getWishlist: () => [makeWishlistItem(1), makeWishlistItem(2)]
    })
    const useCase = new FetchOwnableDeals(
      { fetchDealsBySteamAppIds },
      { fetchMetadata: vi.fn(async () => null) },
      { getRecord: vi.fn(), recordObservation: vi.fn() },
      cacheRepository,
      makeSessionLogRepository(),
      makeHistoryRepository(),
      makeSettingsRepository()
    )

    await useCase.execute()

    expect(cacheRepository.getPendingDealsAppIds()).toEqual([])
  })
})
