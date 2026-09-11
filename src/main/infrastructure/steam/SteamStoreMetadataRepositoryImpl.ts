import type { GameMetadata } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'

interface AppDetailsResponse {
  [appId: string]: {
    success: boolean
    data?: {
      name?: string
      genres?: Array<{ id: string; description: string }>
      header_image?: string
      price_overview?: {
        final: number
        discount_percent: number
      }
    }
  }
}

/**
 * Usa o endpoint público (sem chave) da loja Steam para gênero, capa e o
 * preço/desconto% da Steam (o GG.deals não devolve percentual de desconto).
 * Não documentado oficialmente e com rate limit informal da Valve (~200
 * req/5min por IP) — por isso é consumido um AppID por vez e cacheado.
 */
export class SteamStoreMetadataRepositoryImpl implements GameMetadataRepository {
  async fetchMetadata(appId: number): Promise<GameMetadata | null> {
    const url = new URL('https://store.steampowered.com/api/appdetails')
    url.searchParams.set('appids', String(appId))
    url.searchParams.set('l', 'brazilian')
    url.searchParams.set('cc', 'br')

    try {
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        logger.warn(`appdetails HTTP ${res.status} para appId ${appId}`)
        return null
      }

      const data = (await res.json()) as AppDetailsResponse
      const entry = data[String(appId)]
      if (!entry?.success || !entry.data) return null

      return {
        appId,
        title: entry.data.name ?? null,
        genres: entry.data.genres?.map((g) => g.description) ?? [],
        headerImageUrl: entry.data.header_image ?? null,
        steamPrice: entry.data.price_overview ? entry.data.price_overview.final / 100 : null,
        steamDiscountPercent: entry.data.price_overview?.discount_percent ?? null
      }
    } catch (error) {
      logger.warn(`Falha ao buscar metadata do appId ${appId}`, error)
      return null
    }
  }
}
