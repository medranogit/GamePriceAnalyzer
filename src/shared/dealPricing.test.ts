import { describe, expect, it } from 'vitest'
import type { GameDeal } from './types'
import {
  getBestCurrentPrice,
  getBestHistoricalLow,
  isAtOrBelowHistoricalLow,
  qualifiesAsDeal
} from './dealPricing'

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
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

describe('getBestCurrentPrice', () => {
  it('retorna null quando não há preço nenhum', () => {
    expect(getBestCurrentPrice(makeDeal())).toBeNull()
  })

  it('escolhe o menor preço entre loja oficial e keyshop', () => {
    const deal = makeDeal({ currentRetailPrice: 100, currentKeyshopPrice: 80 })
    expect(getBestCurrentPrice(deal)).toEqual({ price: 80, label: 'Keyshop' })
  })

  it('usa o único preço disponível quando só um existe', () => {
    const deal = makeDeal({ currentRetailPrice: 100, currentKeyshopPrice: null })
    expect(getBestCurrentPrice(deal)).toEqual({ price: 100, label: 'Loja oficial' })
  })
})

describe('getBestHistoricalLow', () => {
  it('retorna null quando não há histórico', () => {
    expect(getBestHistoricalLow(makeDeal())).toBeNull()
  })

  it('escolhe o menor entre histórico de loja oficial e keyshop', () => {
    const deal = makeDeal({ historicalRetailLow: 50, historicalKeyshopLow: 40 })
    expect(getBestHistoricalLow(deal)).toBe(40)
  })
})

describe('isAtOrBelowHistoricalLow', () => {
  it('true quando o preço atual iguala o menor histórico', () => {
    const deal = makeDeal({ currentRetailPrice: 40, historicalRetailLow: 40 })
    expect(isAtOrBelowHistoricalLow(deal)).toBe(true)
  })

  it('true quando o preço atual é menor que o menor histórico', () => {
    const deal = makeDeal({ currentRetailPrice: 35, historicalRetailLow: 40 })
    expect(isAtOrBelowHistoricalLow(deal)).toBe(true)
  })

  it('false quando o preço atual é maior que o menor histórico', () => {
    const deal = makeDeal({ currentRetailPrice: 45, historicalRetailLow: 40 })
    expect(isAtOrBelowHistoricalLow(deal)).toBe(false)
  })

  it('false quando falta preço atual ou histórico', () => {
    expect(isAtOrBelowHistoricalLow(makeDeal({ historicalRetailLow: 40 }))).toBe(false)
    expect(isAtOrBelowHistoricalLow(makeDeal({ currentRetailPrice: 40 }))).toBe(false)
  })
})

describe('qualifiesAsDeal', () => {
  it('qualifica quando o desconto da Steam atinge o mínimo', () => {
    const deal = makeDeal({ steamDiscountPercent: 50 })
    expect(qualifiesAsDeal(deal, 50)).toBe(true)
  })

  it('não qualifica quando o desconto da Steam fica abaixo do mínimo e não é preço histórico mínimo', () => {
    const deal = makeDeal({ steamDiscountPercent: 30 })
    expect(qualifiesAsDeal(deal, 50)).toBe(false)
  })

  it('qualifica pelo menor preço histórico mesmo sem desconto suficiente na Steam', () => {
    const deal = makeDeal({ steamDiscountPercent: 10, currentRetailPrice: 40, historicalRetailLow: 40 })
    expect(qualifiesAsDeal(deal, 50)).toBe(true)
  })

  it('trata desconto ausente (null) como zero', () => {
    const deal = makeDeal({ steamDiscountPercent: null })
    expect(qualifiesAsDeal(deal, 1)).toBe(false)
  })
})
