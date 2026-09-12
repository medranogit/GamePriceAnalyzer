import type { GameDeal } from '@shared/types'

export interface DealsRepository {
  /**
   * Cruza preço/menor histórico (retail vs keyshop) para os AppIDs Steam informados. `onBatch`,
   * quando informado, é chamado com o resultado de cada lote assim que ele chega — antes de esperar
   * pelo próximo — pra quem chamou poder salvar o progresso incrementalmente (ver FetchOwnableDeals).
   */
  fetchDealsBySteamAppIds(
    appIds: number[],
    onBatch?: (deals: GameDeal[]) => Promise<void> | void
  ): Promise<GameDeal[]>
}
