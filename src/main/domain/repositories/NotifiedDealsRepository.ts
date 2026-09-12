import type { NotifiedDealRecord } from '@shared/types'

export interface NotifiedDealsRepository {
  /** true se já notificamos esse AppID nesse preço ou num preço menor (ou seja, não é novidade). */
  alreadyNotifiedForPrice(appId: number, price: number): boolean
  markNotified(record: NotifiedDealRecord): void
  /** Esquece tudo que já foi notificado — as próximas ofertas que ainda qualificarem podem notificar de novo. */
  clear(): void
}
