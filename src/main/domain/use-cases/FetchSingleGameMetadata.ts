import type { GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncCachedDealsForAppId } from '../dealMetadataSync'

export class FetchSingleGameMetadata {
  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(appId: number): Promise<GameMetadata | null> {
    const title = this.cacheRepository.getOwnedGames().find((game) => game.appId === appId)?.name
    this.sessionLogRepository.log('info', `Buscando metadata da Steam pra "${title ?? `AppID ${appId}`}"...`)

    const metadata = await this.metadataRepository.fetchMetadata(appId)
    if (!metadata) {
      this.sessionLogRepository.log(
        'warn',
        `Não consegui metadata da Steam pra "${title ?? `AppID ${appId}`}".`
      )
      return null
    }

    this.cacheRepository.setMetadata(metadata)
    syncCachedDealsForAppId(this.cacheRepository, appId, metadata, true)
    this.sessionLogRepository.log('success', `Metadata resolvida pra "${metadata.title}".`)
    return metadata
  }
}
