import type { GameMetadata, QueueSource } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import type { SingleGameFetchProgressTracker } from '../../domain/SingleGameFetchProgressTracker'
import type { LocalTrailerCache } from '../storage/LocalTrailerCache'

/**
 * Decora qualquer GameMetadataRepository: se "Baixar trailers localmente" estiver ligado em
 * Configurações, baixa o pacote HLS completo (manifest + segmentos) de cada trailer pra disco, trocando
 * a URL do vídeo pela versão local. Fica ligado/desligado independente do cache de capa/screenshots
 * (LocalImageCachingGameMetadataRepository) — são dois toggles separados em Configurações.
 */
export class LocalTrailerCachingGameMetadataRepository implements GameMetadataRepository {
  constructor(
    private readonly inner: GameMetadataRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly trailerCache: LocalTrailerCache,
    private readonly progressTracker: SingleGameFetchProgressTracker
  ) {}

  async fetchMetadata(appId: number, source?: QueueSource): Promise<GameMetadata | null> {
    const metadata = await this.inner.fetchMetadata(appId, source)
    if (!metadata) return metadata
    if (!this.settingsRepository.get().downloadTrailersLocally) return metadata

    this.progressTracker.addTotal(appId, metadata.trailers.length)

    const trailers = await Promise.all(
      metadata.trailers.map(async (trailer) => {
        const url = await this.trailerCache.cacheTrailer(trailer.url, appId)
        this.progressTracker.addCompleted(appId)
        return { ...trailer, url }
      })
    )

    return { ...metadata, trailers }
  }
}
