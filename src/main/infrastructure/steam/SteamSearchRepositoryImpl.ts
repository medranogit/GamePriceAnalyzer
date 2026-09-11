import type { SteamSearchResult } from '@shared/types'
import type { SteamSearchRepository } from '../../domain/repositories/SteamSearchRepository'
import { fetchWithRetry } from '../http/fetchWithRetry'
import { logger } from '../logging/logger'

interface StoreSearchResponse {
  items?: Array<{
    id: number
    type: string
    name: string
    tiny_image?: string
  }>
}

/**
 * Endpoint público (sem chave) de busca da loja Steam, usado para o usuário
 * encontrar um jogo pelo nome ao adicionar na wishlist manualmente.
 */
export class SteamSearchRepositoryImpl implements SteamSearchRepository {
  async searchGames(query: string): Promise<SteamSearchResult[]> {
    if (!query.trim()) return []

    const url = new URL('https://store.steampowered.com/api/storesearch/')
    url.searchParams.set('term', query)
    url.searchParams.set('l', 'brazilian')
    url.searchParams.set('cc', 'br')

    try {
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        logger.warn(`storesearch HTTP ${res.status}`)
        return []
      }

      const data = (await res.json()) as StoreSearchResponse
      return (data.items ?? [])
        .filter((item) => item.type === 'app')
        .map((item) => ({
          appId: item.id,
          name: item.name,
          tinyImageUrl: item.tiny_image ?? null
        }))
    } catch (error) {
      logger.warn(`Falha ao buscar "${query}" na Steam`, error)
      return []
    }
  }
}
