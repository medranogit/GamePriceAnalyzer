import type { GameAchievements } from '@shared/types'
import type { SteamAchievementsRepository } from '../repositories/SteamAchievementsRepository'

export class FetchGameAchievements {
  constructor(private readonly achievementsRepository: SteamAchievementsRepository) {}

  execute(steamId64: string, appId: number): Promise<GameAchievements | null> {
    return this.achievementsRepository.fetchAchievements(steamId64, appId)
  }
}
