import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice, qualifiesAsDeal } from '@shared/dealPricing'
import type { FetchOwnableDeals } from './FetchOwnableDeals'
import type { NotifiedDealsRepository } from '../repositories/NotifiedDealsRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

const BATCH_NOTIFICATION_THRESHOLD = 5

export interface NotificationService {
  notifyDeal(deal: GameDeal): void
  /** Uma única notificação resumindo várias ofertas de uma vez — ver BATCH_NOTIFICATION_THRESHOLD. */
  notifyDealsBatch(deals: GameDeal[]): void
}

/**
 * Executado a cada tick do polling em background. Reaproveita FetchOwnableDeals
 * (que traz TUDO, sem filtro) e só notifica quem realmente vale a pena, segundo
 * a regra configurável em Configurações (`polling.notifyMinDiscountPercent` /
 * `notifyOnHistoricalLow` — independente do filtro de exibição do Dashboard) —
 * e uma vez por preço (só notifica de novo se o preço cair ainda mais).
 *
 * Se muitas ofertas qualificarem no mesmo tick (ex: um backfill de metadata
 * que revela um monte de desconto de keyshop de uma vez), notificar uma por
 * uma inunda o SO com notificações quase simultâneas. Acima de
 * BATCH_NOTIFICATION_THRESHOLD, agrupa tudo numa notificação única.
 */
export class CheckDealAlerts {
  constructor(
    private readonly fetchOwnableDeals: FetchOwnableDeals,
    private readonly notifiedDealsRepository: NotifiedDealsRepository,
    private readonly notificationService: NotificationService,
    private readonly historyRepository: HistoryRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    this.sessionLogRepository.log('info', 'Iniciando busca de ofertas...')

    try {
      const deals = await this.fetchOwnableDeals.execute()
      const { notifyMinDiscountPercent, notifyOnHistoricalLow } = this.settingsRepository.get().polling

      const toNotify: Array<{ deal: GameDeal; appId: number; price: number; label: string }> = []
      for (const deal of deals) {
        if (deal.appId === null) continue
        const best = getBestCurrentPrice(deal)
        const qualifies =
          best !== null &&
          qualifiesAsDeal(deal, { minDiscountPercent: notifyMinDiscountPercent, notifyOnHistoricalLow })

        if (!best || !qualifies) {
          // Preço voltou ao normal (ou não qualifica mais) — esquece, pra notificar de novo na
          // próxima vez que voltar a qualificar, mesmo que o novo preço não seja o mais baixo já visto.
          this.notifiedDealsRepository.clearForAppId(deal.appId)
          continue
        }
        if (this.notifiedDealsRepository.alreadyNotifiedForPrice(deal.appId, best.price)) continue
        toNotify.push({ deal, appId: deal.appId, price: best.price, label: best.label })
      }

      const isBurst = toNotify.length > BATCH_NOTIFICATION_THRESHOLD
      if (isBurst) {
        this.notificationService.notifyDealsBatch(toNotify.map((item) => item.deal))
        this.sessionLogRepository.log(
          'warn',
          `${toNotify.length} ofertas qualificaram no mesmo ciclo — agrupadas numa notificação única pra não inundar o sistema.`
        )
      }

      for (const { deal, appId, price, label } of toNotify) {
        if (!isBurst) {
          this.notificationService.notifyDeal(deal)
        }
        this.notifiedDealsRepository.markNotified({
          appId,
          lastNotifiedPrice: price,
          lastNotifiedAt: new Date().toISOString()
        })
        this.historyRepository.addEvent(
          'deal_found',
          `${deal.title}: ${deal.currency ?? ''} ${price.toFixed(2)} (${label})`.trim()
        )
        this.sessionLogRepository.log(
          'success',
          `Oferta notificada: ${deal.title} — ${deal.currency ?? ''} ${price.toFixed(2)} (${label})`.trim()
        )
      }

      this.sessionLogRepository.log(
        'success',
        `Busca de ofertas concluída: ${deals.length} jogo(s) analisado(s), ${toNotify.length} notificação(ões) disparada(s).`
      )
      return toNotify.map((item) => item.deal)
    } catch (error) {
      this.sessionLogRepository.log(
        'error',
        `Falha na busca de ofertas: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }
}
