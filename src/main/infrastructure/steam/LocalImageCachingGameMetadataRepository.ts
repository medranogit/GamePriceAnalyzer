import type { GameMetadata, QueueSource } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import type { SingleGameFetchProgressTracker } from '../../domain/SingleGameFetchProgressTracker'
import type { LocalImageCache } from '../storage/LocalImageCache'

/**
 * Decora qualquer GameMetadataRepository: se "Baixar imagens localmente" estiver ligado em Configurações,
 * baixa capa, screenshots e a miniatura de cada trailer pra disco (via LocalImageCache) e devolve a
 * metadata já com essas URLs trocadas pelas locais — o resto do app nem sabe a diferença, só usa a URL
 * que veio no campo. O vídeo do trailer em si nunca é baixado (pesado demais), só a miniatura.
 */
export class LocalImageCachingGameMetadataRepository implements GameMetadataRepository {
  constructor(
    private readonly inner: GameMetadataRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly imageCache: LocalImageCache,
    private readonly progressTracker: SingleGameFetchProgressTracker
  ) {}

  async fetchMetadata(appId: number, source?: QueueSource): Promise<GameMetadata | null> {
    const metadata = await this.inner.fetchMetadata(appId, source)
    if (!metadata) return metadata
    if (!this.settingsRepository.get().downloadImagesLocally) return metadata

    const cacheImage = async (url: string): Promise<string> => {
      const result = await this.imageCache.cacheImage(url, appId)
      this.progressTracker.addCompleted(appId)
      return result
    }

    const imageCount =
      (metadata.headerImageUrl ? 1 : 0) +
      metadata.screenshots.length +
      metadata.trailers.filter((trailer) => trailer.thumbnailUrl).length
    this.progressTracker.addTotal(appId, imageCount)

    const [headerImageUrl, screenshots, trailers] = await Promise.all([
      metadata.headerImageUrl ? cacheImage(metadata.headerImageUrl) : metadata.headerImageUrl,
      Promise.all(metadata.screenshots.map((url) => cacheImage(url))),
      Promise.all(
        metadata.trailers.map(async (trailer) => ({
          ...trailer,
          thumbnailUrl: trailer.thumbnailUrl ? await cacheImage(trailer.thumbnailUrl) : trailer.thumbnailUrl
        }))
      )
    ])

    return { ...metadata, headerImageUrl, screenshots, trailers }
  }
}
