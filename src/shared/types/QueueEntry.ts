/** Timer/use-case que disparou aquela busca de metadata — usado só pra agrupar a fila na tela "Fila de
 * Chamadas" (ver CallQueuePage). Ausente nas chamadas do GG.deals, que só têm uma origem possível. */
export type QueueSource = 'ofertas' | 'wishlist' | 'biblioteca' | 'backfill' | 'refresh' | 'manual'

export interface QueueEntry {
  id: number
  label: string
  status: 'waiting' | 'running'
  source?: QueueSource
}
