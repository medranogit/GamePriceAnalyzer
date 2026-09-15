import type { GameDeal, GGDealsQuotaStatus } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import type { QueueActivityTracker } from '../../domain/QueueActivityTracker'

const BASE_URL = 'https://api.gg.deals/v1/prices/by-steam-app-id/'
/** Limite real da API do GG.deals por chamada HTTP — não é configurável, é um teto de segurança. */
const GG_DEALS_HARD_LIMIT = 100
/** Cota real da conta, documentada pela GG.deals — usado só pra exibir "quanto já foi usado" na Fila de Chamadas. */
const GG_DEALS_HOURLY_LIMIT = 1000
/** Pausa entre lotes do mesmo ciclo — só entre um e outro, nunca depois do último. */
const BATCH_DELAY_MS = 5_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  /** true só em HTTP 429 de verdade — diferente de uma resposta 200 sem dados pra nenhum AppID do lote
   * (GG.deals simplesmente não rastreia esses jogos). Um lote rate-limited não conta como processado
   * (fica pendente pra próxima busca); um lote vazio-mas-bem-sucedido conta (ver FetchOwnableDeals). */
  rateLimited: boolean
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
  private lastKnownRemaining: number | null = null
  private lastCheckedAt: string | null = null

  constructor(
    private readonly apiKeyProvider: () => string | null,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly tracker?: QueueActivityTracker
  ) {}

  /** Estimativa de "agora" pra exibição (ex: Fila de Chamadas) — baseada só no último header de
   * rate limit que a própria API devolveu, não persiste entre reinícios do app. */
  getQuotaStatus(): GGDealsQuotaStatus {
    return {
      remaining: this.lastKnownRemaining,
      limit: GG_DEALS_HOURLY_LIMIT,
      checkedAt: this.lastCheckedAt
    }
  }

  async getPricesBySteamAppIds(
    appIds: number[],
    batchSize: number,
    onBatch?: (deals: GameDeal[], requestedAppIds: number[]) => Promise<void> | void
  ): Promise<PricesResult> {
    const apiKey = this.apiKeyProvider()
    if (!apiKey) {
      throw new Error('GG_DEALS_API_KEY não configurada. Cadastre a chave em Configurações.')
    }
    if (appIds.length === 0) return { deals: [], processedAppIdCount: 0 }

    // Nunca confia cegamente no valor configurado — o limite real da API é fixo, então clampa aqui
    // como última linha de defesa, independente do que vier de Configurações.
    const effectiveBatchSize = Math.min(batchSize, GG_DEALS_HARD_LIMIT)
    const batches = chunk(appIds, effectiveBatchSize)
    const deals: GameDeal[] = []
    let processedAppIdCount = 0
    let lastResult: BatchResult | null = null

    this.sessionLogRepository.log(
      'info',
      `Consultando GG.deals: ${appIds.length} jogo(s) em ${batches.length} lote(s) de até ${effectiveBatchSize}.`
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

      if (result.rateLimited) {
        const remainingAppIds = appIds.length - processedAppIdCount
        const message = `GG.deals retornou HTTP 429 (rate limit) no lote ${i + 1}/${batches.length} — ${remainingAppIds} jogo(s) ficam pra próxima busca.`
        logger.warn(message)
        this.sessionLogRepository.log('warn', message)
        break
      }

      deals.push(...result.deals)
      processedAppIdCount += batch.length
      this.sessionLogRepository.log(
        'success',
        `Lote ${i + 1}/${batches.length} concluído: ${result.deals.length} preço(s) recebido(s).`
      )
      await onBatch?.(result.deals, batch)
      lastResult = result

      if (i < batches.length - 1) {
        await sleep(BATCH_DELAY_MS)
      }
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
    if (remaining !== null) {
      this.lastKnownRemaining = remaining
      this.lastCheckedAt = new Date().toISOString()
    }

    if (res.status === 429) {
      return { deals: [], remaining: 0, rateLimited: true }
    }
    if (!res.ok) {
      this.sessionLogRepository.log('error', `GG.deals prices falhou: HTTP ${res.status}`)
      throw new Error(`GG.deals prices falhou: HTTP ${res.status}`)
    }

    const body = (await res.json()) as RawResponse
    if (!body.success || !body.data) return { deals: [], remaining, rateLimited: false }

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
    return { deals, remaining, rateLimited: false }
  }
}
