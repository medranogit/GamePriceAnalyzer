import type { GameMetadata } from '@shared/types'

export interface GameMetadataRepository {
  fetchMetadata(appId: number): Promise<GameMetadata | null>
}
