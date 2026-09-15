import { describe, expect, it } from 'vitest'
import type { GameMetadata } from '@shared/types'
import { describeMetadata } from './describeMetadata'

function makeMetadata(overrides: Partial<GameMetadata> = {}): GameMetadata {
  return {
    appId: 1,
    title: 'Game 1',
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
    trailers: [],
    dlcAppIds: [],
    isDlc: false,
    parentAppId: null,
    ...overrides
  }
}

describe('describeMetadata', () => {
  it('cita quantas DLCs o jogo base tem', () => {
    const result = describeMetadata(makeMetadata({ dlcAppIds: [100, 200, 300] }))

    expect(result).toContain('3 DLC(s)')
  })

  it('cita quando o próprio AppID é uma DLC', () => {
    const result = describeMetadata(makeMetadata({ isDlc: true, parentAppId: 1091500 }))

    expect(result).toContain('é DLC')
  })

  it('devolve "sem dados adicionais" quando nada foi encontrado', () => {
    const result = describeMetadata(makeMetadata())

    expect(result).toBe('sem dados adicionais')
  })
})
