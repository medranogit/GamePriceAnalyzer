import type { GameAchievements } from '@shared/types'

export interface SteamAchievementsRepository {
  fetchAchievements(steamId64: string, appId: number): Promise<GameAchievements | null>
}
