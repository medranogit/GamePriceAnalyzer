import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
import type { AppCacheRepository } from '../../domain/repositories/AppCacheRepository'
import { JsonFileStore } from './JsonFileStore'

interface CacheSchema {
  ownedGames: OwnedGame[]
  wishlist: WishlistItem[]
  deals: GameDeal[]
  metadata: Record<string, GameMetadata>
}

const DEFAULTS: CacheSchema = { ownedGames: [], wishlist: [], deals: [], metadata: {} }

export class ElectronStoreAppCacheRepository implements AppCacheRepository {
  private readonly store = new JsonFileStore<CacheSchema>('cache.json', DEFAULTS)

  getOwnedGames(): OwnedGame[] {
    return this.store.read().ownedGames
  }

  setOwnedGames(games: OwnedGame[]): void {
    this.store.write({ ...this.store.read(), ownedGames: games })
  }

  getWishlist(): WishlistItem[] {
    return this.store.read().wishlist
  }

  setWishlist(items: WishlistItem[]): void {
    this.store.write({ ...this.store.read(), wishlist: items })
  }

  getDeals(): GameDeal[] {
    return this.store.read().deals
  }

  setDeals(deals: GameDeal[]): void {
    this.store.write({ ...this.store.read(), deals })
  }

  upsertDeals(deals: GameDeal[]): void {
    const current = this.store.read()
    const byAppId = new Map(current.deals.map((d) => [d.appId, d]))
    for (const deal of deals) {
      byAppId.set(deal.appId, deal)
    }
    this.store.write({ ...current, deals: [...byAppId.values()] })
  }

  getMetadata(appId: number): GameMetadata | null {
    return this.store.read().metadata[String(appId)] ?? null
  }

  setMetadata(metadata: GameMetadata): void {
    const current = this.store.read()
    this.store.write({
      ...current,
      metadata: { ...current.metadata, [String(metadata.appId)]: metadata }
    })
  }
}
