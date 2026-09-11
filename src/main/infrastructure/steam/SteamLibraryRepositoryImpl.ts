import type { OwnedGame } from '@shared/types'
import type { SteamLibraryRepository } from '../../domain/repositories/SteamLibraryRepository'
import type { SteamWebApiClient } from './SteamWebApiClient'

export class SteamLibraryRepositoryImpl implements SteamLibraryRepository {
  constructor(private readonly client: SteamWebApiClient) {}

  async fetchOwnedGames(steamId64: string): Promise<OwnedGame[]> {
    return this.client.getOwnedGames(steamId64)
  }
}
