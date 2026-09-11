import type {
  SteamSpecialCandidate,
  SteamSpecialsRepository
} from '../../domain/repositories/SteamSpecialsRepository'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'

interface FeaturedCategoriesResponse {
  specials?: {
    items?: Array<{
      id: number
      name: string
      discount_percent: number
      header_image?: string
    }>
  }
}

/**
 * Endpoint público (sem chave) de destaques da loja Steam, usado só para
 * descobrir quais jogos estão em promoção agora — o preço "de verdade"
 * multi-loja vem do GG.deals a partir desses AppIDs.
 */
export class SteamSpecialsRepositoryImpl implements SteamSpecialsRepository {
  async fetchCurrentSpecials(): Promise<SteamSpecialCandidate[]> {
    const url = new URL('https://store.steampowered.com/api/featuredcategories')
    url.searchParams.set('l', 'brazilian')
    url.searchParams.set('cc', 'br')

    const res = await fetchWithRetry(url)
    if (!res.ok) {
      logger.error(`featuredcategories HTTP ${res.status}`)
      return []
    }

    const data = (await res.json()) as FeaturedCategoriesResponse
    const items = data.specials?.items ?? []

    return items.map((item) => ({
      appId: item.id,
      name: item.name,
      discountPercent: item.discount_percent,
      headerImageUrl: item.header_image ?? null
    }))
  }
}
