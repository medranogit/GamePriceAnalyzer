import type { GameDeal } from '@shared/types'

/**
 * Preserva o `firstSeenAt` de ofertas já vistas antes (procurando pelo AppID
 * no cache anterior) e marca como "agora" só quem é realmente novo — assim a
 * ordem de chegada é estável entre buscas, não reseta a cada fetch.
 */
export function preserveFirstSeenAt(newDeals: GameDeal[], previousDeals: GameDeal[]): GameDeal[] {
  const firstSeenByAppId = new Map(
    previousDeals.filter((deal) => deal.appId !== null).map((deal) => [deal.appId, deal.firstSeenAt])
  )

  return newDeals.map((deal) => {
    const previousFirstSeenAt = deal.appId !== null ? firstSeenByAppId.get(deal.appId) : undefined
    return previousFirstSeenAt ? { ...deal, firstSeenAt: previousFirstSeenAt } : deal
  })
}
