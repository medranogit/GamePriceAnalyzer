import type { GameMetadata, QueueSource } from '@shared/types'

export interface GameMetadataRepository {
  /** `source` identifica qual timer/use-case pediu essa busca — só usado pra agrupar a fila de Steam
   * Metadata na tela "Fila de Chamadas" (ver ThrottledGameMetadataRepository), não afeta o resultado. */
  fetchMetadata(appId: number, source?: QueueSource): Promise<GameMetadata | null>
}
