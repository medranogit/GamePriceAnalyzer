import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameMetadata } from '@shared/types'
import type { GameMetadataRepository } from '../../domain/repositories/GameMetadataRepository'
import { ThrottledGameMetadataRepository } from './ThrottledGameMetadataRepository'

function makeMetadata(appId: number): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
    genres: [],
    headerImageUrl: null,
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
    trailers: []
  }
}

describe('ThrottledGameMetadataRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('deixa a primeira chamada passar direto, sem esperar nada', async () => {
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const repository = new ThrottledGameMetadataRepository({ fetchMetadata })

    const result = await repository.fetchMetadata(1)

    expect(result).toEqual(makeMetadata(1))
    expect(fetchMetadata).toHaveBeenCalledTimes(1)
  })

  it('espera 1,5s entre o fim de uma chamada e o início da próxima, mesmo vindo de "use-cases" diferentes ao mesmo tempo', async () => {
    vi.useFakeTimers()
    const fetchMetadata = vi.fn(async (appId: number) => makeMetadata(appId))
    const inner: GameMetadataRepository = { fetchMetadata }
    const repository = new ThrottledGameMetadataRepository(inner)

    // Simula duas operações concorrentes (ex: "buscar ofertas" e "buscar metadados" rodando juntas)
    // chamando fetchMetadata pro mesmo repositório compartilhado, uma logo depois da outra.
    const first = repository.fetchMetadata(1)
    const second = repository.fetchMetadata(2)
    const third = repository.fetchMetadata(3)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMetadata).toHaveBeenCalledTimes(1)
    expect(fetchMetadata).toHaveBeenCalledWith(1)

    await vi.advanceTimersByTimeAsync(1499)
    expect(fetchMetadata).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenCalledWith(2)

    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchMetadata).toHaveBeenCalledTimes(3)
    expect(fetchMetadata).toHaveBeenCalledWith(3)

    await Promise.all([first, second, third])
  })

  it('continua respeitando o intervalo mesmo quando uma chamada falha', async () => {
    vi.useFakeTimers()
    const fetchMetadata = vi
      .fn<GameMetadataRepository['fetchMetadata']>()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce(makeMetadata(2))
    const repository = new ThrottledGameMetadataRepository({ fetchMetadata })

    const first = repository.fetchMetadata(1).catch(() => null)
    const second = repository.fetchMetadata(2)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMetadata).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1499)
    expect(fetchMetadata).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMetadata).toHaveBeenCalledTimes(2)

    await first
    expect(await second).toEqual(makeMetadata(2))
  })
})
