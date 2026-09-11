import type { OwnedGame } from '@shared/types'

export interface SteamLibraryRepository {
  fetchOwnedGames(steamId64: string): Promise<OwnedGame[]>
}
