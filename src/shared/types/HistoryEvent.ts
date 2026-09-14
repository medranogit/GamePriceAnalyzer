export type HistoryEventType =
  | 'deal_found'
  | 'library_sync'
  | 'wishlist_import'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'offers_sync'
  | 'metadata_backfill'
  | 'metadata_refresh'
  | 'error'

export interface HistoryEvent {
  id: string
  type: HistoryEventType
  message: string
  timestamp: string
  /** AppID do jogo que esse evento é sobre, quando é um evento por-jogo (ex: metadata resolvida pra um
   * jogo específico) — ausente em eventos de ciclo/resumo (ex: "Biblioteca sincronizada: X jogos"). */
  appId?: number | null
}
