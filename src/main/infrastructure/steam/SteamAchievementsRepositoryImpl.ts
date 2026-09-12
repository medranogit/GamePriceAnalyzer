import type { GameAchievements } from '@shared/types'
import type { SteamAchievementsRepository } from '../../domain/repositories/SteamAchievementsRepository'
import type { SteamWebApiClient } from './SteamWebApiClient'

export class SteamAchievementsRepositoryImpl implements SteamAchievementsRepository {
  constructor(private readonly client: SteamWebApiClient) {}

  async fetchAchievements(steamId64: string, appId: number): Promise<GameAchievements | null> {
    return this.client.getGameAchievements(steamId64, appId)
  }
}
