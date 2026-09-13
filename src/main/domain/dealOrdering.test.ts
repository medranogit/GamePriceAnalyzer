import { describe, expect, it } from 'vitest'
import type { GameDeal } from '@shared/types'
import { preserveFirstSeenAt } from './dealOrdering'

function makeDeal(overrides: Partial<GameDeal> = {}): GameDeal {
  return {
    appId: 730,
    title: 'Counter-Strike 2',
    genres: [],
    ggDealsUrl: 'https://gg.deals/game/counter-strike-2/',
    currency: 'BRL',
    currentRetailPrice: null,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
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
    trailers: [],
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

describe('preserveFirstSeenAt', () => {
  it('mantém o firstSeenAt original de uma oferta já vista antes', () => {
    const previous = [makeDeal({ appId: 730, firstSeenAt: '2026-01-01T00:00:00.000Z' })]
    const next = [makeDeal({ appId: 730, firstSeenAt: '2026-02-01T00:00:00.000Z' })]

    const result = preserveFirstSeenAt(next, previous)

    expect(result[0].firstSeenAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('mantém o firstSeenAt "novo" (agora) de uma oferta que nunca foi vista', () => {
    const previous: GameDeal[] = []
    const next = [makeDeal({ appId: 999, firstSeenAt: '2026-02-01T00:00:00.000Z' })]

    const result = preserveFirstSeenAt(next, previous)

    expect(result[0].firstSeenAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('não deixa uma oferta com appId null quebrar o cruzamento por appId', () => {
    const previous = [makeDeal({ appId: null, firstSeenAt: '2026-01-01T00:00:00.000Z' })]
    const next = [makeDeal({ appId: null, firstSeenAt: '2026-02-01T00:00:00.000Z' })]

    const result = preserveFirstSeenAt(next, previous)

    expect(result[0].firstSeenAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('preserva a ordem e o tamanho da lista nova', () => {
    const previous = [makeDeal({ appId: 1 })]
    const next = [makeDeal({ appId: 2 }), makeDeal({ appId: 1 }), makeDeal({ appId: 3 })]

    const result = preserveFirstSeenAt(next, previous)

    expect(result.map((d) => d.appId)).toEqual([2, 1, 3])
  })
})
