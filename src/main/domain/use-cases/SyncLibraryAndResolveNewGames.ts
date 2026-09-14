import type { OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../repositories/SteamLibraryRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncCachedDealsForAppId } from '../dealMetadataSync'
import { describeMetadata } from '../describeMetadata'

/**
 * Sincroniza a lista de jogos possuídos (GetOwnedGames) e busca a metadata da Steam só de quem é
 * genuinamente novo (appId que não estava na biblioteca cacheada antes) — mesmo padrão do
 * `SyncSteamWishlist`, adaptado pra biblioteca. Roda tanto pelo timer automático quanto pelo botão
 * "Sincronizar com a Steam" (Minha Biblioteca).
 */
export class SyncLibraryAndResolveNewGames {
  constructor(
    private readonly steamLibraryRepository: SteamLibraryRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(steamId64: string): Promise<OwnedGame[]> {
    this.sessionLogRepository.log('info', 'Buscando jogos possuídos via Steam Web API (GetOwnedGames)...')
    try {
      const previousAppIds = new Set(this.cacheRepository.getOwnedGames().map((game) => game.appId))
      const games = await this.steamLibraryRepository.fetchOwnedGames(steamId64)
      this.cacheRepository.setOwnedGames(games)

      const newGames = games.filter((game) => !previousAppIds.has(game.appId))
      const { removedFromWishlist, removedFromDeals } =
        newGames.length > 0
          ? this.removeFromWishlistAndDeals(newGames)
          : { removedFromWishlist: 0, removedFromDeals: 0 }

      for (const game of newGames) {
        this.historyRepository.addEvent('library_sync', `Novo na biblioteca: "${game.name}".`, game.appId)
        this.sessionLogRepository.log(
          'info',
          `Jogo novo na biblioteca — buscando metadata pra "${game.name}"...`
        )
        const metadata = await this.metadataRepository.fetchMetadata(game.appId)
        if (metadata) {
          this.cacheRepository.setMetadata(metadata)
          syncCachedDealsForAppId(this.cacheRepository, game.appId, metadata)
          this.sessionLogRepository.log(
            'success',
            `Metadata resolvida pra "${game.name}": ${describeMetadata(metadata)}.`
          )
        } else {
          this.sessionLogRepository.log('warn', `Não consegui metadata da Steam pra "${game.name}".`)
        }
      }

      // Logado só agora, depois de processar cada jogo novo — assim esse resumo fica com o timestamp
      // mais recente do ciclo e aparece no topo do grupo no Histórico (mais novo primeiro), com os
      // eventos individuais de cada jogo logo abaixo como detalhe.
      const removalSuffix =
        removedFromWishlist > 0 || removedFromDeals > 0
          ? ` Removido da wishlist (${removedFromWishlist}) e das ofertas (${removedFromDeals}) por já ser possuído.`
          : ''
      const message = `Biblioteca Steam sincronizada: ${games.length} jogos (${newGames.length} novo(s)).${removalSuffix}`
      this.historyRepository.addEvent('library_sync', message)
      this.sessionLogRepository.log('success', message)

      return games
    } catch (error) {
      this.sessionLogRepository.log(
        'error',
        `Falha ao sincronizar biblioteca: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Um jogo recém-detectado como possuído já saiu da wishlist da Steam (ela remove sozinha ao comprar) —
   * poda direto daqui em vez de esperar o próximo ciclo da sync da wishlist ou de Ofertas perceberem
   * sozinhos, o que evitava o jogo continuar aparecendo em uma das duas telas por até um ciclo inteiro.
   */
  private removeFromWishlistAndDeals(newGames: OwnedGame[]): {
    removedFromWishlist: number
    removedFromDeals: number
  } {
    const newAppIds = new Set(newGames.map((game) => game.appId))

    const wishlist = this.cacheRepository.getWishlist()
    const prunedWishlist = wishlist.filter((item) => !newAppIds.has(item.appId))
    if (prunedWishlist.length !== wishlist.length) {
      this.cacheRepository.setWishlist(prunedWishlist)
    }

    const deals = this.cacheRepository.getDeals()
    const prunedDeals = deals.filter((deal) => deal.appId === null || !newAppIds.has(deal.appId))
    if (prunedDeals.length !== deals.length) {
      this.cacheRepository.setDeals(prunedDeals)
    }

    return {
      removedFromWishlist: wishlist.length - prunedWishlist.length,
      removedFromDeals: deals.length - prunedDeals.length
    }
  }
}
