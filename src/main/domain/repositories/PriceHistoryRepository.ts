import type { LocalPriceRecord } from '@shared/types'

/**
 * Guarda, por AppID, o menor preço (loja oficial e keyshop) que ESTE programa
 * já observou ao longo do tempo — diferente do histórico do GG.deals, que
 * remonta a anos antes de o usuário instalar o app.
 */
export interface PriceHistoryRepository {
  getRecord(appId: number): LocalPriceRecord | null
  recordObservation(
    appId: number,
    currency: string | null,
    retailPrice: number | null,
    keyshopPrice: number | null
  ): LocalPriceRecord
}
