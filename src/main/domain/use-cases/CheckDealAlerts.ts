import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice, qualifiesAsDeal } from '@shared/dealPricing'
import type { FetchOwnableDeals } from './FetchOwnableDeals'
import type { NotifiedDealsRepository } from '../repositories/NotifiedDealsRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'

export interface NotificationService {
  notifyDeal(deal: GameDeal): void
}

/**
 * Executado a cada tick do polling em background. Reaproveita FetchOwnableDeals
 * (que traz TUDO, sem filtro) e só notifica quem realmente vale a pena —
 * desconto mínimo configurado OU menor preço histórico do GG.deals — e uma
 * vez por preço (só notifica de novo se o preço cair ainda mais).
 */
export class CheckDealAlerts {
  constructor(
    private readonly fetchOwnableDeals: FetchOwnableDeals,
    private readonly notifiedDealsRepository: NotifiedDealsRepository,
    private readonly notificationService: NotificationService,
    private readonly historyRepository: HistoryRepository,
    private readonly settingsRepository: SettingsRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    const deals = await this.fetchOwnableDeals.execute()
    const { minDiscountPercent } = this.settingsRepository.get().filters
    const newlyNotified: GameDeal[] = []

    for (const deal of deals) {
      const best = getBestCurrentPrice(deal)
      if (deal.appId === null || !best) continue
      if (!qualifiesAsDeal(deal, minDiscountPercent)) continue

      const price = best.price
      if (this.notifiedDealsRepository.alreadyNotifiedForPrice(deal.appId, price)) continue

      this.notificationService.notifyDeal(deal)
      this.notifiedDealsRepository.markNotified({
        appId: deal.appId,
        lastNotifiedPrice: price,
        lastNotifiedAt: new Date().toISOString()
      })
      this.historyRepository.addEvent(
        'deal_found',
        `${deal.title}: ${deal.currency ?? ''} ${price.toFixed(2)} (${best.label})`.trim()
      )
      newlyNotified.push(deal)
    }

    return newlyNotified
  }
}
