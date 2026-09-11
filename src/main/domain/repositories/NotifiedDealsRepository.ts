import type { NotifiedDealRecord } from '@shared/types'

export interface NotifiedDealsRepository {
  /** true se já notificamos esse AppID nesse preço ou num preço menor (ou seja, não é novidade). */
  alreadyNotifiedForPrice(appId: number, price: number): boolean
  markNotified(record: NotifiedDealRecord): void
}
