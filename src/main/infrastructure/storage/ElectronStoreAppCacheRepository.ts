import type { GameDeal, GameMetadata, OwnedGame, WishlistItem } from '@shared/types'
import type { AppCacheRepository } from '../../domain/repositories/AppCacheRepository'
import { JsonFileStore } from './JsonFileStore'

/**
 * Um JsonFileStore por concern — evita reescrever tudo (ex: centenas de
 * ofertas) só porque uma seção pequena (metadata de 1 jogo) mudou, e deixa
 * cada arquivo inspecionável sozinho.
 */
export class ElectronStoreAppCacheRepository implements AppCacheRepository {
  private readonly ownedGamesStore = new JsonFileStore<OwnedGame[]>('library.json', [])
  private readonly wishlistStore = new JsonFileStore<WishlistItem[]>('wishlist.json', [])
  private readonly dealsStore = new JsonFileStore<GameDeal[]>('deals-cache.json', [])
  private readonly wishlistDealsStore = new JsonFileStore<GameDeal[]>('wishlist-deals-cache.json', [])
  private readonly metadataStore = new JsonFileStore<Record<string, GameMetadata>>('metadata-cache.json', {})

  getOwnedGames(): OwnedGame[] {
    return this.ownedGamesStore.read()
  }

  setOwnedGames(games: OwnedGame[]): void {
    this.ownedGamesStore.write(games)
  }

  getWishlist(): WishlistItem[] {
    return this.wishlistStore.read()
  }

  setWishlist(items: WishlistItem[]): void {
    this.wishlistStore.write(items)
  }

  getDeals(): GameDeal[] {
    return this.dealsStore.read()
  }

  setDeals(deals: GameDeal[]): void {
    this.dealsStore.write(deals)
  }

  getWishlistDeals(): GameDeal[] {
    return this.wishlistDealsStore.read()
  }

  setWishlistDeals(deals: GameDeal[]): void {
    this.wishlistDealsStore.write(deals)
  }

  getMetadata(appId: number): GameMetadata | null {
    return this.metadataStore.read()[String(appId)] ?? null
  }

  setMetadata(metadata: GameMetadata): void {
    const current = this.metadataStore.read()
    this.metadataStore.write({ ...current, [String(metadata.appId)]: metadata })
  }

  getAllMetadata(): GameMetadata[] {
    return Object.values(this.metadataStore.read())
  }
}
