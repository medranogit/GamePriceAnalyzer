import type { GameMetadata } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
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
    private readonly imageCache: LocalImageCache
  ) {}

  async fetchMetadata(appId: number): Promise<GameMetadata | null> {
    const metadata = await this.inner.fetchMetadata(appId)
    if (!metadata) return metadata
    if (!this.settingsRepository.get().downloadImagesLocally) return metadata

    const [headerImageUrl, screenshots, trailers] = await Promise.all([
      metadata.headerImageUrl
        ? this.imageCache.cacheImage(metadata.headerImageUrl, appId)
        : metadata.headerImageUrl,
      Promise.all(metadata.screenshots.map((url) => this.imageCache.cacheImage(url, appId))),
      Promise.all(
        metadata.trailers.map(async (trailer) => ({
          ...trailer,
          thumbnailUrl: trailer.thumbnailUrl
            ? await this.imageCache.cacheImage(trailer.thumbnailUrl, appId)
            : trailer.thumbnailUrl
        }))
      )
    ])

    return { ...metadata, headerImageUrl, screenshots, trailers }
  }
}
