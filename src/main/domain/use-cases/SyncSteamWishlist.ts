import type { WishlistItem } from '@shared/types'
import type { SteamWishlistRepository } from '../repositories/SteamWishlistRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'

const STEAM_RATE_LIMIT_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sincroniza a wishlist direto da Steam (sem precisar de chave, só do
 * SteamID64) — substitui a importação manual de JSON. Só resolve o título
 * (via Steam appdetails, com uma pausa de propósito) pra AppIDs realmente
 * novos, o que torna a primeira sincronização mais lenta mas as seguintes
 * quase instantâneas.
 */
export class SyncSteamWishlist {
  constructor(
    private readonly steamWishlistRepository: SteamWishlistRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  async execute(steamId64: string): Promise<WishlistItem[]> {
    const liveEntries = await this.steamWishlistRepository.fetchWishlistAppIds(steamId64)
    const currentByAppId = new Map(this.cacheRepository.getWishlist().map((item) => [item.appId, item]))

    const nextWishlist: WishlistItem[] = []
    let newlyResolvedCount = 0

    for (const entry of liveEntries) {
      const existing = currentByAppId.get(entry.appId)
      if (existing) {
        nextWishlist.push({ ...existing, addedDate: entry.addedAt })
        continue
      }

      const cachedMetadata = this.cacheRepository.getMetadata(entry.appId)
      const metadata = cachedMetadata ?? (await this.metadataRepository.fetchMetadata(entry.appId))
      if (metadata && !cachedMetadata) {
        this.cacheRepository.setMetadata(metadata)
      }
      if (!cachedMetadata) {
        newlyResolvedCount += 1
        await sleep(STEAM_RATE_LIMIT_DELAY_MS)
      }

      nextWishlist.push({
        appId: entry.appId,
        title: metadata?.title ?? `AppID ${entry.appId}`,
        storeUrl: `https://store.steampowered.com/app/${entry.appId}/`,
        addedDate: entry.addedAt,
        releaseDate: '',
        currentPrice: null,
        discountPercent: 0,
        reviewCount: 0,
        reviewPositivePercent: 0
      })
    }

    this.cacheRepository.setWishlist(nextWishlist)
    this.historyRepository.addEvent(
      'wishlist_import',
      `Wishlist sincronizada com a Steam: ${nextWishlist.length} jogos (${newlyResolvedCount} novos).`
    )
    return nextWishlist
  }
}
