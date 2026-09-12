import type { NotifiedDealRecord } from '@shared/types'

export interface NotifiedDealsRepository {
  /** true se já notificamos esse AppID nesse preço ou num preço menor (ou seja, não é novidade). */
  alreadyNotifiedForPrice(appId: number, price: number): boolean
  markNotified(record: NotifiedDealRecord): void
  /**
   * Esquece um AppID específico — usado quando ele deixa de qualificar (preço voltou ao normal),
   * pra que a próxima vez que voltar a qualificar notifique de novo, mesmo que o novo preço não seja
   * menor que o menor já notificado antes (cada "onda" de desconto notifica uma vez).
   */
  clearForAppId(appId: number): void
  /** Esquece tudo que já foi notificado — as próximas ofertas que ainda qualificarem podem notificar de novo. */
  clear(): void
}
