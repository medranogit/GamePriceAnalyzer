import { describe, expect, it, vi } from 'vitest'
import type { GameMetadata } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import type { LocalTrailerCache } from '../storage/LocalTrailerCache'
import { LocalTrailerCachingGameMetadataRepository } from './LocalTrailerCachingGameMetadataRepository'

function makeMetadata(overrides: Partial<GameMetadata> = {}): GameMetadata {
  return {
    appId: 1,
    title: 'Game 1',
    genres: ['RPG'],
    headerImageUrl: 'https://steamstatic.example.com/cover.jpg',
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: null,
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    trailers: [
      {
        url: 'https://steamstatic.example.com/trailer1.m3u8',
        thumbnailUrl: 'https://steamstatic.example.com/thumb1.jpg'
      },
      {
        url: 'https://steamstatic.example.com/trailer2.m3u8',
        thumbnailUrl: 'https://steamstatic.example.com/thumb2.jpg'
      }
    ],
    ...overrides
  }
}

function makeSettingsRepository(downloadTrailersLocally: boolean): SettingsRepository {
  return {
    get: () => ({ ...DEFAULT_SETTINGS, downloadTrailersLocally }),
    update: vi.fn()
  }
}

describe('LocalTrailerCachingGameMetadataRepository', () => {
  it('não mexe nas URLs dos trailers quando o setting está desligado', async () => {
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => makeMetadata()) }
    const cacheTrailer = vi.fn(async (url: string) => `app-video://trailers/x/${url}`)
    const trailerCache = { cacheTrailer } as unknown as LocalTrailerCache
    const repository = new LocalTrailerCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(false),
      trailerCache
    )

    const result = await repository.fetchMetadata(1)

    expect(cacheTrailer).not.toHaveBeenCalled()
    expect(result?.trailers[0].url).toBe('https://steamstatic.example.com/trailer1.m3u8')
  })

  it('baixa o vídeo de cada trailer quando o setting está ligado, mantendo a thumbnail intacta', async () => {
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => makeMetadata()) }
    const cacheTrailer = vi.fn(
      async (url: string) => `app-video://trailers/cached/${encodeURIComponent(url)}`
    )
    const trailerCache = { cacheTrailer } as unknown as LocalTrailerCache
    const repository = new LocalTrailerCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(true),
      trailerCache
    )

    const result = await repository.fetchMetadata(1)

    expect(cacheTrailer).toHaveBeenCalledWith('https://steamstatic.example.com/trailer1.m3u8', 1)
    expect(cacheTrailer).toHaveBeenCalledWith('https://steamstatic.example.com/trailer2.m3u8', 1)
    expect(result?.trailers[0].url).toContain('app-video://')
    expect(result?.trailers[0].thumbnailUrl).toBe('https://steamstatic.example.com/thumb1.jpg')
    expect(result?.trailers[1].thumbnailUrl).toBe('https://steamstatic.example.com/thumb2.jpg')
  })

  it('devolve null sem chamar o cache quando a Steam não devolve metadata', async () => {
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => null) }
    const cacheTrailer = vi.fn()
    const trailerCache = { cacheTrailer } as unknown as LocalTrailerCache
    const repository = new LocalTrailerCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(true),
      trailerCache
    )

    const result = await repository.fetchMetadata(1)

    expect(result).toBeNull()
    expect(cacheTrailer).not.toHaveBeenCalled()
  })
})
