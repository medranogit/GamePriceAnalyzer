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
      const message = `Biblioteca Steam sincronizada: ${games.length} jogos (${newGames.length} novo(s)).`
      this.historyRepository.addEvent('library_sync', message)
      this.sessionLogRepository.log('success', message)

      for (const game of newGames) {
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

      return games
    } catch (error) {
      this.sessionLogRepository.log(
        'error',
        `Falha ao sincronizar biblioteca: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }
}
