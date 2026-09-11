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

/**
 * A API do GG.deals não devolve porcentagem de desconto por loja (só preço
 * atual e menor histórico). Pra enxergar desconto forte de keyshop — que não
 * aparece no `steamDiscountPercent` (esse é só o desconto ativo na própria
 * Steam) — comparamos o melhor preço atual (loja oficial ou keyshop) contra o
 * preço cheio (sem desconto) da Steam, único "preço de tabela" que temos.
 */
export function getEffectiveDiscountPercent(deal: GameDeal): number | null {
  const best = getBestCurrentPrice(deal)
  // `!deal.steamFullPrice` (em vez de `=== null`) cobre de propósito também `undefined` —
  // ofertas cacheadas por uma versão anterior à introdução deste campo não o têm no JSON
  // salvo em disco, e um `undefined` escapando pra conta abaixo vira NaN, que quebra
  // silenciosamente qualquer comparação `>=` de filtro (NaN >= X é sempre falso).
  if (!best || !deal.steamFullPrice || deal.steamFullPrice <= 0) return null
  const percent = ((deal.steamFullPrice - best.price) / deal.steamFullPrice) * 100
  return Math.round(percent)
}

/** Melhor estimativa de desconto pra exibição/filtro: o efetivo (vs. preço cheio da Steam) ou, na falta dele, o da própria Steam. */
export function getDisplayDiscountPercent(deal: GameDeal): number {
  return getEffectiveDiscountPercent(deal) ?? deal.steamDiscountPercent ?? 0
}

/** Vale notificar/considerar "oferta boa": desconto mínimo (efetivo ou da Steam) OU menor preço histórico do GG.deals. */
export function qualifiesAsDeal(deal: GameDeal, minDiscountPercent: number): boolean {
  return getDisplayDiscountPercent(deal) >= minDiscountPercent || isAtOrBelowHistoricalLow(deal)
}
