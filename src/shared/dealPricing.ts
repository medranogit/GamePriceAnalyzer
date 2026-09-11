import type { GameDeal } from './types'

export interface BestPrice {
  price: number
  label: 'Loja oficial' | 'Keyshop'
}

export function getBestCurrentPrice(deal: GameDeal): BestPrice | null {
  const candidates: BestPrice[] = []
  if (deal.currentRetailPrice !== null)
    candidates.push({ price: deal.currentRetailPrice, label: 'Loja oficial' })
  if (deal.currentKeyshopPrice !== null)
    candidates.push({ price: deal.currentKeyshopPrice, label: 'Keyshop' })
  if (candidates.length === 0) return null
  return candidates.reduce((min, c) => (c.price < min.price ? c : min))
}

export function getBestHistoricalLow(deal: GameDeal): number | null {
  const candidates = [deal.historicalRetailLow, deal.historicalKeyshopLow].filter(
    (v): v is number => v !== null
  )
  return candidates.length ? Math.min(...candidates) : null
}

/** Preço atual já bate o menor preço histórico do GG.deals — "ótima oferta" mesmo sem desconto ativo na Steam. */
export function isAtOrBelowHistoricalLow(deal: GameDeal): boolean {
  const best = getBestCurrentPrice(deal)
  const historicalLow = getBestHistoricalLow(deal)
  return best !== null && historicalLow !== null && best.price <= historicalLow
}

/** Vale notificar/considerar "oferta boa": desconto mínimo na Steam OU menor preço histórico do GG.deals. */
export function qualifiesAsDeal(deal: GameDeal, minDiscountPercent: number): boolean {
  const hasEnoughSteamDiscount = (deal.steamDiscountPercent ?? 0) >= minDiscountPercent
  return hasEnoughSteamDiscount || isAtOrBelowHistoricalLow(deal)
}
