import type { NotifiedDealRecord } from '@shared/types'
import type { NotifiedDealsRepository } from '../../domain/repositories/NotifiedDealsRepository'
import { JsonFileStore } from './JsonFileStore'

interface NotifiedSchema {
  records: Record<string, NotifiedDealRecord>
}

/**
 * Evita notificação repetida pro mesmo preço: só dispara de novo se o preço
 * cair ainda mais (uma oferta melhor que a já notificada). Não expira por
 * tempo — o mesmo preço nunca mais notifica sozinho.
 */
export class ElectronStoreNotifiedDealsRepository implements NotifiedDealsRepository {
  private readonly store = new JsonFileStore<NotifiedSchema>('notified-deals.json', { records: {} })

  alreadyNotifiedForPrice(appId: number, price: number): boolean {
    const record = this.store.read().records[String(appId)]
    if (!record) return false
    return price >= record.lastNotifiedPrice
  }

  markNotified(record: NotifiedDealRecord): void {
    const current = this.store.read()
    this.store.write({ records: { ...current.records, [String(record.appId)]: record } })
  }

  clearForAppId(appId: number): void {
    const current = this.store.read()
    const key = String(appId)
    if (!(key in current.records)) return
    const records = { ...current.records }
    delete records[key]
    this.store.write({ records })
  }

  clear(): void {
    this.store.write({ records: {} })
  }
}
