import type { GameDeal } from '@shared/types'
import type { DealsRepository } from '../../domain/repositories/DealsRepository'
import type { GGDealsApiClient } from './GGDealsApiClient'

export class DealsRepositoryImpl implements DealsRepository {
  constructor(private readonly client: GGDealsApiClient) {}

  async fetchDealsBySteamAppIds(
    appIds: number[],
    onBatch?: (deals: GameDeal[]) => Promise<void> | void
  ): Promise<GameDeal[]> {
    return this.client.getPricesBySteamAppIds(appIds, onBatch)
  }
}
