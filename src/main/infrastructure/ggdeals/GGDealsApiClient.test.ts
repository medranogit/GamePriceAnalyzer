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
  })

  it('processa todos os lotes quando o rate limit tem folga de sobra', async () => {
    const appIds = Array.from({ length: 150 }, (_, i) => i + 1) // 2 lotes: 100 + 50
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 500, successBody(appIds.slice(0, 100))))
      .mockResolvedValueOnce(makeResponse(200, 450, successBody(appIds.slice(100, 150))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const result = await client.getPricesBySteamAppIds(appIds)

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(150)
    expect(result.deals).toHaveLength(150)
  })

  it('para de enviar lotes assim que o rate limit restante não cobre o próximo lote, sem esperar o reset', async () => {
    const appIds = Array.from({ length: 250 }, (_, i) => i + 1) // 3 lotes de 100/100/50
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(makeResponse(200, 100, successBody(appIds.slice(0, 100))))
      .mockResolvedValueOnce(makeResponse(200, 10, successBody(appIds.slice(100, 200))))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const result = await client.getPricesBySteamAppIds(appIds)

    // 3º lote (50 AppIDs) não cabe no `remaining` de 10 deixado pelo 2º lote — para na hora, sem
    // tentar mais nada (e sem dormir esperando o reset da janela).
    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(result.processedAppIdCount).toBe(200)
  })

  it('trata 429 como orçamento zerado e para de enviar lotes seguintes', async () => {
    const appIds = Array.from({ length: 150 }, (_, i) => i + 1)
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(429, null, {}))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const result = await client.getPricesBySteamAppIds(appIds)

    expect(fetchWithRetry).toHaveBeenCalledTimes(1)
    expect(result.processedAppIdCount).toBe(100)
    expect(result.deals).toEqual([])
  })

  it('marca priceUpdatedAt em cada oferta com o momento em que o preço foi buscado', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(makeResponse(200, 500, successBody([1])))
    const client = new GGDealsApiClient(() => 'key', makeSessionLogRepository())

    const before = Date.now()
    const result = await client.getPricesBySteamAppIds([1])
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

    await client.getPricesBySteamAppIds([1])

    expect(tracker.getSnapshot()).toEqual([])
  })
})
