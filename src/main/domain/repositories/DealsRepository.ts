import type { GameDeal } from '@shared/types'

export interface DealsRepository {
  /** Cruza preço/menor histórico (retail vs keyshop) para os AppIDs Steam informados. */
  fetchDealsBySteamAppIds(appIds: number[]): Promise<GameDeal[]>
}
