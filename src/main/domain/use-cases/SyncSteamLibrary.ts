import type { OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../repositories/SteamLibraryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'

export class SyncSteamLibrary {
  constructor(
    private readonly steamLibraryRepository: SteamLibraryRepository,
    private readonly cacheRepository: AppCacheRepository
  ) {}

  async execute(steamId64: string): Promise<OwnedGame[]> {
    const games = await this.steamLibraryRepository.fetchOwnedGames(steamId64)
    this.cacheRepository.setOwnedGames(games)
    return games
  }
}
