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
      short_description?: string
      price_overview?: {
        initial: number
        final: number
        discount_percent: number
      }
      developers?: string[]
      publishers?: string[]
      release_date?: { coming_soon: boolean; date: string }
      metacritic?: { score: number; url: string }
      recommendations?: { total: number }
      screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>
      movies?: Array<{
        id: number
        highlight: boolean
        // Alguns vídeos da Steam só têm `webm`, sem `mp4` — por isso opcional, não vale assumir presença.
        mp4?: { '480': string; max?: string }
      }>
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

      const movie = entry.data.movies?.find((m) => m.highlight) ?? entry.data.movies?.[0]
      const trailerUrl = movie?.mp4 ? (movie.mp4.max ?? movie.mp4['480']) : null

      return {
        appId,
        title: entry.data.name ?? null,
        genres: entry.data.genres?.map((g) => g.description) ?? [],
        headerImageUrl: entry.data.header_image ?? null,
        steamPrice: entry.data.price_overview ? entry.data.price_overview.final / 100 : null,
        steamDiscountPercent: entry.data.price_overview?.discount_percent ?? null,
        steamFullPrice: entry.data.price_overview ? entry.data.price_overview.initial / 100 : null,
        shortDescription: entry.data.short_description ?? null,
        developers: entry.data.developers ?? [],
        publishers: entry.data.publishers ?? [],
        releaseDate: entry.data.release_date?.coming_soon ? null : (entry.data.release_date?.date ?? null),
        metacriticScore: entry.data.metacritic?.score ?? null,
        recommendationsTotal: entry.data.recommendations?.total ?? null,
        screenshots: entry.data.screenshots?.slice(0, 5).map((s) => s.path_full) ?? [],
        trailerUrl
      }
    } catch (error) {
      logger.warn(`Falha ao buscar metadata do appId ${appId}`, error)
      return null
    }
  }
}
