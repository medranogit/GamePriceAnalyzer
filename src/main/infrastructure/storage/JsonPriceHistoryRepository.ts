import type { LocalPriceRecord } from '@shared/types'
import type { PriceHistoryRepository } from '../../domain/repositories/PriceHistoryRepository'
import { JsonFileStore } from './JsonFileStore'

interface PriceHistorySchema {
  records: Record<string, LocalPriceRecord>
}

export class JsonPriceHistoryRepository implements PriceHistoryRepository {
  private readonly store = new JsonFileStore<PriceHistorySchema>('price-history.json', { records: {} })

  getRecord(appId: number): LocalPriceRecord | null {
    return this.store.read().records[String(appId)] ?? null
  }

  recordObservation(
    appId: number,
    currency: string | null,
    retailPrice: number | null,
    keyshopPrice: number | null
  ): LocalPriceRecord {
    const current = this.getRecord(appId)
    const next: LocalPriceRecord = {
      appId,
      currency: currency ?? current?.currency ?? null,
      lowestRetail: current?.lowestRetail ?? null,
      lowestRetailAt: current?.lowestRetailAt ?? null,
      lowestKeyshop: current?.lowestKeyshop ?? null,
      lowestKeyshopAt: current?.lowestKeyshopAt ?? null,
      history: current?.history ?? []
    }

    const now = new Date().toISOString()

    if (retailPrice !== null && (next.lowestRetail === null || retailPrice < next.lowestRetail)) {
      next.lowestRetail = retailPrice
      next.lowestRetailAt = now
    }

    if (keyshopPrice !== null && (next.lowestKeyshop === null || keyshopPrice < next.lowestKeyshop)) {
      next.lowestKeyshop = keyshopPrice
      next.lowestKeyshopAt = now
    }

    // Só entra um ponto novo no log quando o preço realmente mudou desde a última observação — do
    // contrário um jogo parado geraria uma entrada idêntica a cada ciclo, pra sempre.
    const lastPoint = next.history[next.history.length - 1]
    const changed =
      !lastPoint || lastPoint.retailPrice !== retailPrice || lastPoint.keyshopPrice !== keyshopPrice
    if (changed) {
      next.history = [...next.history, { timestamp: now, currency: next.currency, retailPrice, keyshopPrice }]
    }

    const state = this.store.read()
    this.store.write({ records: { ...state.records, [String(appId)]: next } })
    return next
  }
}
