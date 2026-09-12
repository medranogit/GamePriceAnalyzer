import type { OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../repositories/SteamLibraryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

export class SyncSteamLibrary {
  constructor(
    private readonly steamLibraryRepository: SteamLibraryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(steamId64: string): Promise<OwnedGame[]> {
    this.sessionLogRepository.log('info', 'Buscando jogos possuídos via Steam Web API (GetOwnedGames)...')
    try {
      const games = await this.steamLibraryRepository.fetchOwnedGames(steamId64)
      this.cacheRepository.setOwnedGames(games)
      const message = `Biblioteca Steam sincronizada: ${games.length} jogos.`
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
}
