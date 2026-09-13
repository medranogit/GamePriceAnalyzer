import type { GameDeal } from '@shared/types'
import type { DealsPricesResult, DealsRepository } from '../../domain/repositories/DealsRepository'
import type { GGDealsApiClient } from './GGDealsApiClient'

export class DealsRepositoryImpl implements DealsRepository {
  constructor(private readonly client: GGDealsApiClient) {}

  async fetchDealsBySteamAppIds(
    appIds: number[],
    onBatch?: (deals: GameDeal[]) => Promise<void> | void
  ): Promise<DealsPricesResult> {
    return this.client.getPricesBySteamAppIds(appIds, onBatch)
  }
}
