import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'

/**
 * Marca/desmarca manualmente uma DLC como possuída — a Steam não expõe isso via API (GetOwnedGames só
 * lista jogo-base), então o usuário confirma na mão. Ao marcar como possuída, remove na hora qualquer
 * oferta cacheada dessa DLC (sem esperar o próximo ciclo de Ofertas perceber sozinho).
 */
export class SetDlcManualOwnership {
  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  execute(appId: number, owned: boolean): number[] {
    const current = new Set(this.cacheRepository.getManuallyOwnedDlcAppIds())
    const changed = owned ? !current.has(appId) : current.has(appId)
    if (owned) {
      current.add(appId)
    } else {
      current.delete(appId)
    }
    const next = [...current]
    this.cacheRepository.setManuallyOwnedDlcAppIds(next)

    if (owned) {
      const deals = this.cacheRepository.getDeals()
      const pruned = deals.filter((deal) => deal.appId !== appId)
      if (pruned.length !== deals.length) {
        this.cacheRepository.setDeals(pruned)
      }
    }

    if (changed) {
      const metadata = this.cacheRepository.getMetadata(appId)
      const title = metadata?.title ?? `AppID ${appId}`
      const message = owned
        ? `DLC marcada manualmente como possuída: "${title}".`
        : `DLC desmarcada como possuída: "${title}".`
      this.historyRepository.addEvent('library_sync', message, appId)
    }

    return next
  }
}
