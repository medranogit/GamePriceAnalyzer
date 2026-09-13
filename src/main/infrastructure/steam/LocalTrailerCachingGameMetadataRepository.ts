import type { GameMetadata } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
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
    private readonly trailerCache: LocalTrailerCache
  ) {}

  async fetchMetadata(appId: number): Promise<GameMetadata | null> {
    const metadata = await this.inner.fetchMetadata(appId)
    if (!metadata) return metadata
    if (!this.settingsRepository.get().downloadTrailersLocally) return metadata

    const trailers = await Promise.all(
      metadata.trailers.map(async (trailer) => ({
        ...trailer,
        url: await this.trailerCache.cacheTrailer(trailer.url, appId)
      }))
    )

    return { ...metadata, trailers }
  }
}
