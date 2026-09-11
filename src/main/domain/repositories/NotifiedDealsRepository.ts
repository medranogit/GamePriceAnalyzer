import type { NotifiedDealRecord } from '@shared/types'

export interface NotifiedDealsRepository {
  wasRecentlyNotified(appId: number, price: number): boolean
  markNotified(record: NotifiedDealRecord): void
}
