import type { GameMetadata, QueueSource } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { QueueActivityTracker } from '../../domain/QueueActivityTracker'

const STEAM_RATE_LIMIT_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Decora qualquer GameMetadataRepository com uma fila global — garante pelo
 * menos STEAM_RATE_LIMIT_DELAY_MS entre uma chamada terminar e a próxima
 * começar, não importa quantos use-cases diferentes estejam chamando
 * fetchMetadata ao mesmo tempo (busca de ofertas, resolução manual de
 * metadata, sync de wishlist). Sem isso, cada fluxo se policia sozinho no
 * próprio ritmo e, rodando em paralelo, o ritmo real de pedidos pro rate
 * limit informal da Steam soma em vez de compartilhar.
 *
 * Opcionalmente reporta cada chamada num `QueueActivityTracker` (pra tela "Fila de Chamadas") — como é
 * o único ponto que sabe de verdade quando um pedido tá esperando a vez vs. já rodando, é aqui (e não
 * num decorator à parte) que a fila de Steam Metadata é instrumentada.
 */
export class ThrottledGameMetadataRepository implements GameMetadataRepository {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly inner: GameMetadataRepository,
    private readonly tracker?: QueueActivityTracker,
    private readonly labelResolver?: (appId: number) => string
  ) {}

  fetchMetadata(appId: number, source?: QueueSource): Promise<GameMetadata | null> {
    const queueId = this.tracker?.enqueue(this.labelResolver?.(appId) ?? `AppID ${appId}`, source)

    const result = this.queue.then(async () => {
      if (queueId !== undefined) this.tracker?.markRunning(queueId)
      try {
        return await this.inner.fetchMetadata(appId)
      } finally {
        if (queueId !== undefined) this.tracker?.finish(queueId)
      }
    })

    this.queue = result.then(
      () => sleep(STEAM_RATE_LIMIT_DELAY_MS),
      () => sleep(STEAM_RATE_LIMIT_DELAY_MS)
    )
    return result
  }
}
