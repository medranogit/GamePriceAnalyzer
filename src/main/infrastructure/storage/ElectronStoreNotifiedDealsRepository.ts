import type { NotifiedDealRecord } from '@shared/types'
import type { NotifiedDealsRepository } from '../../domain/repositories/NotifiedDealsRepository'
import { JsonFileStore } from './JsonFileStore'

const COOLDOWN_DAYS = 30

interface NotifiedSchema {
  records: Record<string, NotifiedDealRecord>
}

/**
 * Evita notificação duplicada: só dispara de novo se o preço mudou, ou se já
 * passaram COOLDOWN_DAYS desde o último alerta pro mesmo AppID no mesmo preço.
 */
export class ElectronStoreNotifiedDealsRepository implements NotifiedDealsRepository {
  private readonly store = new JsonFileStore<NotifiedSchema>('notified-deals.json', { records: {} })

  wasRecentlyNotified(appId: number, price: number): boolean {
    const record = this.store.read().records[String(appId)]
    if (!record) return false
    if (record.lastNotifiedPrice !== price) return false

    const daysSince = (Date.now() - new Date(record.lastNotifiedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince < COOLDOWN_DAYS
  }

  markNotified(record: NotifiedDealRecord): void {
    const current = this.store.read()
    this.store.write({ records: { ...current.records, [String(record.appId)]: record } })
  }
}
