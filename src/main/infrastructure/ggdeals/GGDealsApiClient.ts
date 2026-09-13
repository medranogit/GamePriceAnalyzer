import type { GameDeal } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import type { QueueActivityTracker } from '../../domain/QueueActivityTracker'

const BASE_URL = 'https://api.gg.deals/v1/prices/by-steam-app-id/'
const MAX_IDS_PER_REQUEST = 100

interface RawPrices {
  currentRetail: string | null
  currentKeyshops: string | null
  historicalRetail: string | null
  historicalKeyshops: string | null
  currency: string
}

interface RawGamePrices {
  title: string
  url: string
  prices: RawPrices
}

interface RawResponse {
  success: boolean
  data?: Record<string, RawGamePrices | null>
}

interface BatchResult {
  deals: GameDeal[]
  /** Quantos registros ainda cabem na janela atual, segundo a própria API (null se o header não veio). */
  remaining: number | null
}

export interface PricesResult {
  deals: GameDeal[]
  /** Quantos dos `appIds` pedidos foram realmente tentados nessa chamada — menor que o total quando o
   * rate limit acaba no meio (ver `hasBudgetFor`). O restante fica pra próxima chamada. */
  processedAppIdCount: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function readRemaining(res: Response): number | null {
  const remainingHeader = res.headers.get('x-ratelimit-remaining')
  const remaining = remainingHeader !== null ? Number(remainingHeader) : null
  return Number.isFinite(remaining) ? remaining : null
}

/**
 * Cliente para a Prices API do GG.deals (https://gg.deals/api/prices/).
 * Rate limit real da conta: 100 registros/min, 1000/hora — cada AppID conta
 * como 1 registro, por isso os IDs são enviados em lotes de até 100. Quando o
 * rate limit acaba no meio de uma chamada grande (ex: wishlist enorme), para
 * de enviar lotes na hora (em vez de dormir esperando o reset da janela) e
 * devolve quantos AppIDs foram processados — quem chamou (`FetchOwnableDeals`)
 * decide priorizar o restante na próxima busca.
 */
export class GGDealsApiClient {
  constructor(
    private readonly apiKeyProvider: () => string | null,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly tracker?: QueueActivityTracker
  ) {}

  async getPricesBySteamAppIds(
    appIds: number[],
    onBatch?: (deals: GameDeal[]) => Promise<void> | void
  ): Promise<PricesResult> {
    const apiKey = this.apiKeyProvider()
    if (!apiKey) {
      throw new Error('GG_DEALS_API_KEY não configurada. Cadastre a chave em Configurações.')
    }
    if (appIds.length === 0) return { deals: [], processedAppIdCount: 0 }

    const batches = chunk(appIds, MAX_IDS_PER_REQUEST)
    const deals: GameDeal[] = []
    let processedAppIdCount = 0
    let lastResult: BatchResult | null = null

    this.sessionLogRepository.log(
      'info',
      `Consultando GG.deals: ${appIds.length} jogo(s) em ${batches.length} lote(s) de até ${MAX_IDS_PER_REQUEST}.`
    )

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      if (lastResult && !this.hasBudgetFor(lastResult, batch.length)) {
        const remainingAppIds = appIds.length - processedAppIdCount
        const message = `Rate limit do GG.deals esgotado nesse ciclo — ${remainingAppIds} jogo(s) ficam pra próxima busca.`
        logger.warn(message)
        this.sessionLogRepository.log('warn', message)
        break
      }

      const queueId = this.tracker?.enqueue(`Lote ${i + 1}/${batches.length} — ${batch.length} jogo(s)`)
      this.sessionLogRepository.log(
        'info',
        `Lote ${i + 1}/${batches.length}: enviando ${batch.length} AppID(s)...`
      )

      let result: BatchResult
      try {
        if (queueId !== undefined) this.tracker?.markRunning(queueId)
        result = await this.fetchBatch(batch, apiKey)
      } finally {
        if (queueId !== undefined) this.tracker?.finish(queueId)
      }

      deals.push(...result.deals)
      processedAppIdCount += batch.length
      this.sessionLogRepository.log(
        'success',
        `Lote ${i + 1}/${batches.length} concluído: ${result.deals.length} preço(s) recebido(s).`
      )
      await onBatch?.(result.deals)
      lastResult = result
    }

    return { deals, processedAppIdCount }
  }

  private hasBudgetFor(lastResult: BatchResult, nextBatchSize: number): boolean {
    if (lastResult.remaining === null) return true
    return lastResult.remaining >= nextBatchSize
  }

  private async fetchBatch(appIds: number[], apiKey: string): Promise<BatchResult> {
    const url = new URL(BASE_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('ids', appIds.join(','))
    url.searchParams.set('region', 'br')

    const res = await fetchWithRetry(url)
    const remaining = readRemaining(res)

    if (res.status === 429) {
      logger.warn('GG.deals rate limit atingido (429), pulando esse lote.')
      this.sessionLogRepository.log('warn', 'GG.deals retornou HTTP 429 (rate limit atingido), lote pulado.')
      return { deals: [], remaining: 0 }
    }
    if (!res.ok) {
      this.sessionLogRepository.log('error', `GG.deals prices falhou: HTTP ${res.status}`)
      throw new Error(`GG.deals prices falhou: HTTP ${res.status}`)
    }

    const body = (await res.json()) as RawResponse
    if (!body.success || !body.data) return { deals: [], remaining }

    const deals: GameDeal[] = []
    for (const [appIdKey, entry] of Object.entries(body.data)) {
      if (!entry) continue
      deals.push({
        appId: Number(appIdKey),
        title: entry.title,
        genres: [],
        ggDealsUrl: entry.url,
        currency: entry.prices.currency,
        currentRetailPrice: toNumberOrNull(entry.prices.currentRetail),
        currentKeyshopPrice: toNumberOrNull(entry.prices.currentKeyshops),
        historicalRetailLow: toNumberOrNull(entry.prices.historicalRetail),
        historicalKeyshopLow: toNumberOrNull(entry.prices.historicalKeyshops),
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
        priceUpdatedAt: new Date().toISOString()
      })
    }
    return { deals, remaining }
  }
}
