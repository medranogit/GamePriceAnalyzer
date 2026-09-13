import { describe, expect, it } from 'vitest'
import type { GameDeal, GameMetadata } from '@shared/types'
import { applyMetadataToDeal } from './dealMetadataSync'

function makeMetadata(appId: number, overrides: Partial<GameMetadata> = {}): GameMetadata {
  return {
    appId,
    title: `Game ${appId}`,
    genres: ['RPG'],
    headerImageUrl: 'https://example.com/new-cover.jpg',
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: 'Sinopse nova.',
    developers: ['Dev Nova'],
    publishers: ['Pub Nova'],
    releaseDate: '2024',
    metacriticScore: 90,
    recommendationsTotal: 1000,
    screenshots: ['https://example.com/new-shot.jpg'],
    trailers: [{ url: 'https://example.com/new-trailer.mp4', thumbnailUrl: null }],
    ...overrides
  }
}

function makeDeal(appId: number, overrides: Partial<GameDeal> = {}): GameDeal {
  return {
    appId,
    title: `Game ${appId}`,
    genres: [],
    ggDealsUrl: `https://gg.deals/game/${appId}/`,
    currency: 'BRL',
    currentRetailPrice: 50,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: 'Sinopse antiga.',
    developers: ['Dev Antiga'],
    publishers: ['Pub Antiga'],
    releaseDate: '2020',
    metacriticScore: 50,
    recommendationsTotal: 10,
    screenshots: ['https://example.com/old-shot.jpg'],
    trailers: [{ url: 'https://example.com/old-trailer.mp4', thumbnailUrl: null }],
    coverUrl: 'https://example.com/old-cover.jpg',
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

describe('applyMetadataToDeal', () => {
  it('sem preferFreshMetadata (padrão), mantém o valor que a oferta já tinha, só preenche o que falta', () => {
    const deal = makeDeal(1)
    const metadata = makeMetadata(1)

    const result = applyMetadataToDeal(deal, metadata)

    expect(result.coverUrl).toBe('https://example.com/old-cover.jpg')
    expect(result.shortDescription).toBe('Sinopse antiga.')
    expect(result.developers).toEqual(['Dev Antiga'])
    expect(result.releaseDate).toBe('2020')
    expect(result.metacriticScore).toBe(50)
    expect(result.trailers).toEqual([{ url: 'https://example.com/old-trailer.mp4', thumbnailUrl: null }])
  })

  it('com preferFreshMetadata, sobrescreve com o valor mais recente da Steam mesmo quando a oferta já tinha um valor', () => {
    const deal = makeDeal(1)
    const metadata = makeMetadata(1)

    const result = applyMetadataToDeal(deal, metadata, true)

    expect(result.coverUrl).toBe('https://example.com/new-cover.jpg')
    expect(result.shortDescription).toBe('Sinopse nova.')
    expect(result.developers).toEqual(['Dev Nova'])
    expect(result.releaseDate).toBe('2024')
    expect(result.metacriticScore).toBe(90)
    expect(result.trailers).toEqual([{ url: 'https://example.com/new-trailer.mp4', thumbnailUrl: null }])
  })

  it('com preferFreshMetadata, mantém o valor antigo se a Steam não devolver nada novo dessa vez', () => {
    const deal = makeDeal(1)
    const metadata = makeMetadata(1, {
      genres: [],
      developers: [],
      publishers: [],
      screenshots: [],
      releaseDate: null,
      metacriticScore: null,
      recommendationsTotal: null,
      trailers: [],
      shortDescription: null
    })

    const result = applyMetadataToDeal(deal, metadata, true)

    expect(result.developers).toEqual(['Dev Antiga'])
    expect(result.releaseDate).toBe('2020')
    expect(result.shortDescription).toBe('Sinopse antiga.')
    expect(result.trailers).toEqual([{ url: 'https://example.com/old-trailer.mp4', thumbnailUrl: null }])
  })

  it('retorna a mesma referência quando nada muda (evita reescrever cache à toa)', () => {
    const deal = makeDeal(1)
    const metadata = makeMetadata(1, {
      headerImageUrl: deal.coverUrl,
      shortDescription: deal.shortDescription,
      developers: deal.developers,
      publishers: deal.publishers,
      releaseDate: deal.releaseDate,
      metacriticScore: deal.metacriticScore,
      recommendationsTotal: deal.recommendationsTotal,
      screenshots: deal.screenshots,
      trailers: deal.trailers,
      genres: deal.genres,
      steamPrice: deal.steamPrice,
      steamDiscountPercent: deal.steamDiscountPercent,
      steamFullPrice: deal.steamFullPrice
    })

    const result = applyMetadataToDeal(deal, metadata, true)

    expect(result).toBe(deal)
  })
})
