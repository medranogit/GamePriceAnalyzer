import type { GameMetadata } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'

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
 */
export class ThrottledGameMetadataRepository implements GameMetadataRepository {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly inner: GameMetadataRepository) {}

  fetchMetadata(appId: number): Promise<GameMetadata | null> {
    const result = this.queue.then(() => this.inner.fetchMetadata(appId))
    this.queue = result.then(
      () => sleep(STEAM_RATE_LIMIT_DELAY_MS),
      () => sleep(STEAM_RATE_LIMIT_DELAY_MS)
    )
    return result
  }
}
