import type { WishlistItem } from '@shared/types'
import type { SteamWishlistRepository } from '../repositories/SteamWishlistRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

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
    private readonly historyRepository: HistoryRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(steamId64: string): Promise<WishlistItem[]> {
    this.sessionLogRepository.log('info', 'Iniciando sincronização da wishlist com a Steam...')

    try {
      const liveEntries = await this.steamWishlistRepository.fetchWishlistAppIds(steamId64)
      this.sessionLogRepository.log('info', `Wishlist da Steam: ${liveEntries.length} jogo(s) encontrado(s).`)

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
        if (!cachedMetadata) {
          this.sessionLogRepository.log('info', `AppID ${entry.appId} é novo — buscando metadata na Steam...`)
        }
        const metadata = cachedMetadata ?? (await this.metadataRepository.fetchMetadata(entry.appId))
        if (metadata && !cachedMetadata) {
          this.cacheRepository.setMetadata(metadata)
        }
        if (!cachedMetadata) {
          newlyResolvedCount += 1
        }

        const title = metadata?.title ?? `AppID ${entry.appId}`
        this.historyRepository.addEvent('wishlist_import', `Novo na wishlist: "${title}".`, entry.appId)

        nextWishlist.push({
          appId: entry.appId,
          title,
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
      // Logado só agora, depois do loop — assim esse resumo fica com o timestamp mais recente do ciclo
      // e aparece no topo do grupo no Histórico (mais novo primeiro), com os "Novo na wishlist: X"
      // individuais logo abaixo como detalhe.
      const message = `Wishlist sincronizada com a Steam: ${nextWishlist.length} jogos (${newlyResolvedCount} novos).`
      this.historyRepository.addEvent('wishlist_import', message)
      this.sessionLogRepository.log('success', message)
      return nextWishlist
    } catch (error) {
      this.sessionLogRepository.log(
        'error',
        `Falha ao sincronizar wishlist: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }
}
