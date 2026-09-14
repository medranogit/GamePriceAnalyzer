import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import { QueueActivityTracker } from '../../domain/QueueActivityTracker'

vi.mock('../http/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn()
}))

vi.mock('../logging/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

const { fetchWithRetry } = await import('../http/fetchWithRetry')
const { GGDealsApiClient } = await import('./GGDealsApiClient')

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

function makeResponse(status: number, remaining: number | null, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name === 'x-ratelimit-remaining' && remaining !== null ? String(remaining) : null
    },
    json: async () => body
  } as unknown as Response
}

function successBody(appIds: number[]): unknown {
  const data: Record<string, unknown> = {}
  for (const appId of appIds) {
    data[String(appId)] = {
      title: `Game ${appId}`,
      url: `https://gg.deals/game/${appId}/`,
      prices: {
        currentRetail: '10.00',
        currentKeyshops: null,
        historicalRetail: null,
        historicalKeyshops: null,
        currency: 'BRL'
      }
    }
  }
  return { success: true, data }
}

describe('GGDealsApiClient', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('processa todos os lotes quando o rate limit tem folga de sobra', async () => {
    vi.useFakeTimers()
    const appIds = Array.from({ length: 150 }, (_, i) => i + 1) // 2 lotes: 100 + 50
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 500, successBody(appIds.slice(0, 100))))
      .mockResolvedValueOnce(makeResponse(200, 450, successBody(appIds.slice(100, 150))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const resultPromise = client.getPricesBySteamAppIds(appIds, 100)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(150)
    expect(result.deals).toHaveLength(150)
  })

  it('respeita o tamanho de lote configurado, dividindo os AppIDs em mais chamadas', async () => {
    vi.useFakeTimers()
    const appIds = Array.from({ length: 100 }, (_, i) => i + 1)
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 500, successBody(appIds.slice(0, 50))))
      .mockResolvedValueOnce(makeResponse(200, 450, successBody(appIds.slice(50, 100))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const resultPromise = client.getPricesBySteamAppIds(appIds, 50)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(100)
    expect(result.deals).toHaveLength(100)
  })

  it('nunca deixa o lote passar do limite real da API (100), mesmo se o valor configurado for maior', async () => {
    vi.useFakeTimers()
    const appIds = Array.from({ length: 150 }, (_, i) => i + 1)
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 500, successBody(appIds.slice(0, 100))))
      .mockResolvedValueOnce(makeResponse(200, 450, successBody(appIds.slice(100, 150))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const resultPromise = client.getPricesBySteamAppIds(appIds, 500)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(150)
  })

  it('para de enviar lotes assim que o rate limit restante não cobre o próximo lote, sem esperar o reset', async () => {
    vi.useFakeTimers()
    const appIds = Array.from({ length: 250 }, (_, i) => i + 1) // 3 lotes de 100/100/50
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 100, successBody(appIds.slice(0, 100))))
      .mockResolvedValueOnce(makeResponse(200, 10, successBody(appIds.slice(100, 200))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const resultPromise = client.getPricesBySteamAppIds(appIds, 100)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    // 3º lote (50 AppIDs) não cabe no `remaining` de 10 deixado pelo 2º lote — para na hora, sem
    // tentar mais nada (e sem dormir esperando o reset da janela).
    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(200)
  })

  it('espera 5s entre um lote e outro do mesmo ciclo, mas não depois do último', async () => {
    vi.useFakeTimers()
    const appIds = Array.from({ length: 100 }, (_, i) => i + 1)
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 500, successBody(appIds.slice(0, 50))))
      .mockResolvedValueOnce(makeResponse(200, 450, successBody(appIds.slice(50, 100))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const resultPromise = client.getPricesBySteamAppIds(appIds, 50)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWithRetry).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4_999)
    expect(fetchWithRetry).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchWithRetry).toHaveBeenCalledTimes(2)

    const result = await resultPromise
    expect(result.processedAppIdCount).toBe(100)
  })

  it('conta como processado um lote cuja resposta veio vazia (sem 429) e passa os appIds pedidos pro onBatch', async () => {
    // Regressão real: AppIDs que a GG.deals não rastreia (resposta 200 mas sem dado pra eles) nunca
    // saíam de `pendingDealsAppIds` porque só o que vinha em `deals` era removido de lá — travando o
    // ciclo nesses AppIDs mortos pra sempre, sem nunca voltar a consultar o resto da wishlist.
    const appIds = [111, 222, 333]
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(200, 500, { success: true, data: {} }))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())
    const onBatch = vi.fn()

    const result = await client.getPricesBySteamAppIds(appIds, 100, onBatch)

    expect(result.processedAppIdCount).toBe(3)
    expect(result.deals).toEqual([])
    expect(onBatch).toHaveBeenCalledWith([], appIds)
  })

  it('trata 429 como lote não processado — não conta pro total nem chama onBatch, fica pendente pra retomar', async () => {
    const appIds = Array.from({ length: 150 }, (_, i) => i + 1)
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(429, null, {}))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())
    const onBatch = vi.fn()

    const result = await client.getPricesBySteamAppIds(appIds, 100, onBatch)

    expect(fetchWithRetry).toHaveBeenCalledTimes(1)
    expect(result.processedAppIdCount).toBe(0)
    expect(result.deals).toEqual([])
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('marca priceUpdatedAt em cada oferta com o momento em que o preço foi buscado', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(200, 500, successBody([1])))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const before = Date.now()
    const result = await client.getPricesBySteamAppIds([1], 100)
    const after = Date.now()

    expect(result.deals[0].priceUpdatedAt).toBeDefined()
    const priceUpdatedAtMs = new Date(result.deals[0].priceUpdatedAt as string).getTime()
    expect(priceUpdatedAtMs).toBeGreaterThanOrEqual(before)
    expect(priceUpdatedAtMs).toBeLessThanOrEqual(after)
  })

  it('reporta cada lote na fila enquanto processa', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(200, 500, successBody([1])))
    const tracker = new QueueActivityTracker()
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository(), tracker)

    await client.getPricesBySteamAppIds([1], 100)

    expect(tracker.getSnapshot()).toEqual([])
  })
})
