import type { SteamSearchResult } from '@shared/types'

export interface SteamSearchRepository {
  searchGames(query: string): Promise<SteamSearchResult[]>
}
