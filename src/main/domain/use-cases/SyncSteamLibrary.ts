import type { OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../repositories/SteamLibraryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'

export class SyncSteamLibrary {
  constructor(
    private readonly steamLibraryRepository: SteamLibraryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  async execute(steamId64: string): Promise<OwnedGame[]> {
    const games = await this.steamLibraryRepository.fetchOwnedGames(steamId64)
    this.cacheRepository.setOwnedGames(games)
    this.historyRepository.addEvent('library_sync', `Biblioteca Steam sincronizada: ${games.length} jogos.`)
    return games
  }
}
