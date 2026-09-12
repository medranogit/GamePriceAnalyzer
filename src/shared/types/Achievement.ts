export interface AchievementProgress {
  apiName: string
  displayName: string
  description: string | null
  achieved: boolean
  unlockedAt: string | null
  iconUrl: string
  iconGrayUrl: string
}

export interface GameAchievements {
  appId: number
  total: number
  unlocked: number
  achievements: AchievementProgress[]
}
