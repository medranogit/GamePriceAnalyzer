import type { GameMetadata } from '@shared/types'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import type { FetchProgressStatus, SingleGameFetchProgressTracker } from '../SingleGameFetchProgressTracker'
import { syncCachedDealsForAppId } from '../dealMetadataSync'
import { describeMetadata } from '../describeMetadata'

export class FetchSingleGameMetadata {
  private readonly inFlight = new Map<number, Promise<GameMetadata | null>>()

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly progressTracker: SingleGameFetchProgressTracker
  ) {}

  getProgress(appId: number): FetchProgressStatus | null {
    return this.progressTracker.getStatus(appId)
  }

  /** Uma busca por AppID de cada vez — clicar de novo em "Buscar metadados" pro mesmo jogo enquanto a
   * primeira ainda está rodando (ex: baixando o vídeo do trailer, que pode levar minutos) só acompanha a
   * mesma promise em vez de disparar um segundo download em paralelo do mesmo arquivo. */
  execute(appId: number): Promise<GameMetadata | null> {
    const existing = this.inFlight.get(appId)
    if (existing) return existing

    const promise = this.run(appId).finally(() => {
      this.inFlight.delete(appId)
    })
    this.inFlight.set(appId, promise)
    return promise
  }

  private async run(appId: number): Promise<GameMetadata | null> {
    const title = this.cacheRepository.getOwnedGames().find((game) => game.appId === appId)?.name
    this.sessionLogRepository.log(
      'info',
      `Buscando metadata da Steam individualmente pra "${title ?? `AppID ${appId}`}" (sincronização manual, um jogo só)...`
    )

    this.progressTracker.start(appId)
    try {
      const metadata = await this.metadataRepository.fetchMetadata(appId, 'manual')
      if (!metadata) {
        this.sessionLogRepository.log(
          'warn',
          `Não consegui metadata da Steam pra "${title ?? `AppID ${appId}`}" (sincronização manual, um jogo só).`
        )
        return null
      }

      this.cacheRepository.setMetadata(metadata)
      syncCachedDealsForAppId(this.cacheRepository, appId, metadata, true)
      this.sessionLogRepository.log(
        'success',
        `Metadata resolvida individualmente pra "${metadata.title}": ${describeMetadata(metadata)}.`
      )
      return metadata
    } finally {
      this.progressTracker.finish(appId)
    }
  }
}
