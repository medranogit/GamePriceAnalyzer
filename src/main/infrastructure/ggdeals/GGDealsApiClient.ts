import type { GameDeal } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'

const BASE_URL = 'https://api.gg.deals/v1/prices/by-steam-app-id/'
const MAX_IDS_PER_REQUEST = 100
const DEFAULT_RETRY_AFTER_MS = 61_000

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
  /** Timestamp (ms) de quando a janela de rate limit reseta, se a API informou. */
  resetAtMs: number | null
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readRateLimitHeaders(res: Response): { remaining: number | null; resetAtMs: number | null } {
  const remainingHeader = res.headers.get('x-ratelimit-remaining')
  const resetHeader = res.headers.get('x-ratelimit-reset')
  const remaining = remainingHeader !== null ? Number(remainingHeader) : null
  const resetAtMs = resetHeader !== null ? Number(resetHeader) * 1000 : null
  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAtMs: Number.isFinite(resetAtMs) ? resetAtMs : null
  }
}

/**
 * Cliente para a Prices API do GG.deals (https://gg.deals/api/prices/).
 * Rate limit real da conta: 100 registros/min, 1000/hora — cada AppID conta
 * como 1 registro, por isso os IDs são enviados em lotes de até 100. Quando
 * há mais de um lote (ex: wishlist grande), espera pelo reset da janela de
 * rate limit entre lotes em vez de disparar tudo de uma vez e tomar 429.
 */
export class GGDealsApiClient {
  constructor(
    private readonly apiKeyProvider: () => string | null,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async getPricesBySteamAppIds(appIds: number[]): Promise<GameDeal[]> {
    const apiKey = this.apiKeyProvider()
    if (!apiKey) {
      throw new Error('GG_DEALS_API_KEY não configurada. Cadastre a chave em Configurações.')
    }
    if (appIds.length === 0) return []

    const batches = chunk(appIds, MAX_IDS_PER_REQUEST)
    const deals: GameDeal[] = []

    this.sessionLogRepository.log(
      'info',
      `Consultando GG.deals: ${appIds.length} jogo(s) em ${batches.length} lote(s) de até ${MAX_IDS_PER_REQUEST}.`
    )

    for (let i = 0; i < batches.length; i++) {
      this.sessionLogRepository.log(
        'info',
        `Lote ${i + 1}/${batches.length}: enviando ${batches[i].length} AppID(s)...`
      )
      const result = await this.fetchBatch(batches[i], apiKey)
      deals.push(...result.deals)
      this.sessionLogRepository.log(
        'success',
        `Lote ${i + 1}/${batches.length} concluído: ${result.deals.length} preço(s) recebido(s).`
      )

      const nextBatch = batches[i + 1]
      if (!nextBatch) continue

      const waitMs = this.computeWaitBeforeNextBatch(result, nextBatch.length)
      if (waitMs > 0) {
        const waitMessage = `Aguardando ${Math.ceil(waitMs / 1000)}s pra respeitar o rate limit do GG.deals...`
        logger.info(waitMessage)
        this.sessionLogRepository.log('warn', waitMessage)
        await sleep(waitMs)
      }
    }

    return deals
  }

  private computeWaitBeforeNextBatch(lastResult: BatchResult, nextBatchSize: number): number {
    if (lastResult.remaining === null) return 0
    if (lastResult.remaining >= nextBatchSize) return 0
    if (lastResult.resetAtMs === null) return DEFAULT_RETRY_AFTER_MS
    return Math.max(lastResult.resetAtMs - Date.now(), 0)
  }

  private async fetchBatch(appIds: number[], apiKey: string): Promise<BatchResult> {
    const url = new URL(BASE_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('ids', appIds.join(','))
    url.searchParams.set('region', 'br')

    const res = await fetchWithRetry(url)
    const { remaining, resetAtMs } = readRateLimitHeaders(res)

    if (res.status === 429) {
      logger.warn('GG.deals rate limit atingido (429), pulando esse lote.')
      this.sessionLogRepository.log('warn', 'GG.deals retornou HTTP 429 (rate limit atingido), lote pulado.')
      return { deals: [], remaining: 0, resetAtMs }
    }
    if (!res.ok) {
      this.sessionLogRepository.log('error', `GG.deals prices falhou: HTTP ${res.status}`)
      throw new Error(`GG.deals prices falhou: HTTP ${res.status}`)
    }

    const body = (await res.json()) as RawResponse
    if (!body.success || !body.data) return { deals: [], remaining, resetAtMs }

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
        firstSeenAt: new Date().toISOString()
      })
    }
    return { deals, remaining, resetAtMs }
  }
}
