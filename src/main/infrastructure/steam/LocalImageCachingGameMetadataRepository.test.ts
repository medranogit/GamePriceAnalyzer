import { describe, expect, it, vi } from 'vitest'
import type { GameMetadata } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository'
import { SingleGameFetchProgressTracker } from '../../domain/SingleGameFetchProgressTracker'
import type { LocalImageCache } from '../storage/LocalImageCache'
import { LocalImageCachingGameMetadataRepository } from './LocalImageCachingGameMetadataRepository'

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
    screenshots: ['https://steamstatic.example.com/shot1.jpg', 'https://steamstatic.example.com/shot2.jpg'],
    trailers: [
      {
        url: 'https://steamstatic.example.com/trailer.m3u8',
        thumbnailUrl: 'https://steamstatic.example.com/thumb.jpg'
      }
    ],
    dlcAppIds: [],
    isDlc: false,
    parentAppId: null,
    ...overrides
  }
}

function makeSettingsRepository(downloadImagesLocally: boolean): SettingsRepository {
  return {
    get: () => ({ ...DEFAULT_SETTINGS, downloadImagesLocally }),
    update: vi.fn()
  }
}

describe('LocalImageCachingGameMetadataRepository', () => {
  it('não mexe nas URLs quando o setting está desligado', async () => {
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => makeMetadata()) }
    const cacheImage = vi.fn(async (url: string) => `app-image://cache/1/images/${url}`)
    const imageCache = { cacheImage } as unknown as LocalImageCache
    const repository = new LocalImageCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(false),
      imageCache,
      new SingleGameFetchProgressTracker()
    )

    const result = await repository.fetchMetadata(1)

    expect(cacheImage).not.toHaveBeenCalled()
    expect(result?.headerImageUrl).toBe('https://steamstatic.example.com/cover.jpg')
  })

  it('baixa capa, screenshots e miniaturas de trailer quando o setting está ligado, sem baixar o vídeo em si', async () => {
    const metadata = makeMetadata()
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => metadata) }
    const cacheImage = vi.fn(async (url: string) => `app-image://cache/${encodeURIComponent(url)}`)
    const imageCache = { cacheImage } as unknown as LocalImageCache
    const progressTracker = new SingleGameFetchProgressTracker()
    progressTracker.start(1)
    const repository = new LocalImageCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(true),
      imageCache,
      progressTracker
    )

    const result = await repository.fetchMetadata(1)

    expect(cacheImage).toHaveBeenCalledWith('https://steamstatic.example.com/cover.jpg', 1)
    expect(cacheImage).toHaveBeenCalledWith('https://steamstatic.example.com/shot1.jpg', 1)
    expect(cacheImage).toHaveBeenCalledWith('https://steamstatic.example.com/shot2.jpg', 1)
    expect(cacheImage).toHaveBeenCalledWith('https://steamstatic.example.com/thumb.jpg', 1)
    expect(cacheImage).not.toHaveBeenCalledWith('https://steamstatic.example.com/trailer.m3u8', 1)

    expect(result?.headerImageUrl).toContain('app-image://')
    expect(result?.screenshots.every((url) => url.startsWith('app-image://'))).toBe(true)
    expect(result?.trailers[0].thumbnailUrl).toContain('app-image://')
    expect(result?.trailers[0].url).toBe('https://steamstatic.example.com/trailer.m3u8')

    // 1 capa + 2 screenshots + 1 miniatura de trailer = 4 itens, todos concluídos.
    expect(progressTracker.getStatus(1)).toEqual({ completed: 4, total: 4 })
  })

  it('devolve null sem chamar o cache quando a Steam não devolve metadata', async () => {
    const inner: GameMetadataRepository = { fetchMetadata: vi.fn(async () => null) }
    const cacheImage = vi.fn()
    const imageCache = { cacheImage } as unknown as LocalImageCache
    const repository = new LocalImageCachingGameMetadataRepository(
      inner,
      makeSettingsRepository(true),
      imageCache,
      new SingleGameFetchProgressTracker()
    )

    const result = await repository.fetchMetadata(1)

    expect(result).toBeNull()
    expect(cacheImage).not.toHaveBeenCalled()
  })
})
