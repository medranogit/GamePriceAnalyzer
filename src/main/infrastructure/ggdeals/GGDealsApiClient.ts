import type { GameDeal } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'

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

/**
 * Cliente para a Prices API do GG.deals (https://gg.deals/api/prices/).
 * Rate limit real da conta: 100 registros/min, 1000/hora — cada AppID conta
 * como 1 registro, por isso os IDs são enviados em lotes de até 100.
 */
export class GGDealsApiClient {
  constructor(private readonly apiKeyProvider: () => string | null) {}

  async getPricesBySteamAppIds(appIds: number[]): Promise<GameDeal[]> {
    const apiKey = this.apiKeyProvider()
    if (!apiKey) {
      throw new Error('GG_DEALS_API_KEY não configurada. Cadastre a chave em Configurações.')
    }
    if (appIds.length === 0) return []

    const deals: GameDeal[] = []
    for (const batch of chunk(appIds, MAX_IDS_PER_REQUEST)) {
      deals.push(...(await this.fetchBatch(batch, apiKey)))
    }
    return deals
  }

  private async fetchBatch(appIds: number[], apiKey: string): Promise<GameDeal[]> {
    const url = new URL(BASE_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('ids', appIds.join(','))
    url.searchParams.set('region', 'br')

    const res = await fetchWithRetry(url)
    if (res.status === 429) {
      logger.warn('GG.deals rate limit atingido (429), pulando esse lote.')
      return []
    }
    if (!res.ok) {
      throw new Error(`GG.deals prices falhou: HTTP ${res.status}`)
    }

    const body = (await res.json()) as RawResponse
    if (!body.success || !body.data) return []

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
        steamDiscountPercent: null
      })
    }
    return deals
  }
}
