import type {
  SteamSpecialCandidate,
  SteamSpecialsRepository
} from '../../domain/repositories/SteamSpecialsRepository'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'

const CANDIDATES_PER_PAGE = 100

interface SearchResultsResponse {
  total_count?: number
  results_html?: string
}

/**
 * ATENÇÃO: endpoint interno (não documentado oficialmente) do storefront da
 * Steam — é o mesmo usado pela página "Specials" com scroll infinito. Devolve
 * HTML em vez de JSON, então é parseado com regex. Mais frágil que uma API
 * documentada, mas é estável na prática (usado por várias ferramentas da
 * comunidade) e é a única forma conhecida de listar TODAS as promoções ativas
 * da Steam (o /api/featuredcategories só devolve ~10 itens da vitrine).
 */
export class SteamSpecialsRepositoryImpl implements SteamSpecialsRepository {
  async fetchCurrentSpecials(): Promise<SteamSpecialCandidate[]> {
    const url = new URL('https://store.steampowered.com/search/results/')
    url.searchParams.set('query', '')
    url.searchParams.set('start', '0')
    url.searchParams.set('count', String(CANDIDATES_PER_PAGE))
    url.searchParams.set('specials', '1')
    url.searchParams.set('infinite', '1')
    url.searchParams.set('l', 'brazilian')
    url.searchParams.set('cc', 'br')

    const res = await fetchWithRetry(url)
    if (!res.ok) {
      logger.error(`search/results HTTP ${res.status}`)
      return []
    }

    const data = (await res.json()) as SearchResultsResponse
    const html = data.results_html
    if (!html) return []

    return this.parseListings(html)
  }

  private parseListings(html: string): SteamSpecialCandidate[] {
    const chunks = html.split('<a href="https://store.steampowered.com/app/').slice(1)
    const candidates: SteamSpecialCandidate[] = []

    for (const chunk of chunks) {
      const appIdMatch = chunk.match(/data-ds-appid="(\d+)"/)
      if (!appIdMatch) continue

      const nameMatch = chunk.match(/<span class="title">([^<]+)<\/span>/)
      const discountMatch = chunk.match(/data-discount="(\d+)"/)
      const imageMatch = chunk.match(/<img src="([^"]+)"/)

      candidates.push({
        appId: Number(appIdMatch[1]),
        name: nameMatch ? nameMatch[1] : `AppID ${appIdMatch[1]}`,
        discountPercent: discountMatch ? Number(discountMatch[1]) : 0,
        headerImageUrl: imageMatch ? imageMatch[1] : null
      })
    }

    return candidates
  }
}
