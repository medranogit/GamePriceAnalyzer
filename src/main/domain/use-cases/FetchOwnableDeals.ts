import type { GameDeal } from '@shared/types'
import { preserveFirstSeenAt } from '../dealOrdering'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

const STEAM_RATE_LIMIT_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Orquestra o fluxo principal do app: pega os AppIDs da wishlist, cruza
 * preço/histórico no GG.deals, e descarta o que o usuário já possui — antes
 * de gastar cota da API com isso.
 *
 * Não filtra por desconto/keyshop/gênero aqui: a busca sempre traz TODOS os
 * candidatos (a API não é influenciada pelos filtros de exibição), e quem
 * decide o que aparecer na tela é o renderer, na hora, sem precisar buscar
 * de novo. A única filtragem que continua no domínio é "vale notificar",
 * que é uma decisão de negócio (CheckDealAlerts), não de exibição.
 */
export class FetchOwnableDeals {
  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly sessionLogRepository: SessionLogRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    const ownedAppIds = new Set(this.cacheRepository.getOwnedGames().map((g) => g.appId))

    const allCandidateAppIds = this.cacheRepository.getWishlist().map((w) => w.appId)

    // Descarta o que já é possuído antes de gastar cota da API do GG.deals com isso.
    const candidateAppIds = allCandidateAppIds.filter((appId) => !ownedAppIds.has(appId))
    const ownedSkippedCount = allCandidateAppIds.length - candidateAppIds.length

    this.sessionLogRepository.log(
      'info',
      `Candidatos: ${candidateAppIds.length} jogo(s) da wishlist (${ownedSkippedCount} já possuído(s) descartado(s)).`
    )

    if (candidateAppIds.length === 0) return []

    const rawDeals = await this.dealsRepository.fetchDealsBySteamAppIds(candidateAppIds)
    const deals = preserveFirstSeenAt(rawDeals, this.cacheRepository.getDeals())

    for (const deal of deals) {
      if (deal.appId === null) continue
      this.priceHistoryRepository.recordObservation(
        deal.appId,
        deal.currency,
        deal.currentRetailPrice,
        deal.currentKeyshopPrice
      )
    }

    const enriched = await this.enrichWithMetadata(deals)

    this.cacheRepository.setDeals(enriched)
    this.sessionLogRepository.log('success', `Concluído: ${enriched.length} oferta(s) atualizada(s).`)
    return enriched
  }

  private async enrichWithMetadata(deals: GameDeal[]): Promise<GameDeal[]> {
    const enriched: GameDeal[] = []
    let newlyResolvedCount = 0

    for (const deal of deals) {
      if (deal.appId === null) {
        enriched.push(deal)
        continue
      }

      const cached = this.cacheRepository.getMetadata(deal.appId)
      if (!cached) {
        this.sessionLogRepository.log('info', `Buscando metadata da Steam pra "${deal.title}"...`)
        newlyResolvedCount += 1
      }
      const metadata = cached ?? (await this.metadataRepository.fetchMetadata(deal.appId))
      if (metadata && !cached) {
        this.cacheRepository.setMetadata(metadata)
      }
      if (!metadata && !cached) {
        this.sessionLogRepository.log(
          'warn',
          `Não consegui metadata da Steam pra "${deal.title}" — tento de novo no próximo ciclo.`
        )
      }
      if (!cached) {
        await sleep(STEAM_RATE_LIMIT_DELAY_MS)
      }

      enriched.push({
        ...deal,
        genres: metadata?.genres ?? deal.genres,
        coverUrl: deal.coverUrl ?? metadata?.headerImageUrl ?? undefined,
        steamPrice: metadata?.steamPrice ?? null,
        steamDiscountPercent: metadata?.steamDiscountPercent ?? null,
        steamFullPrice: metadata?.steamFullPrice ?? null,
        shortDescription: metadata?.shortDescription ?? deal.shortDescription ?? null,
        developers: metadata?.developers ?? deal.developers ?? [],
        publishers: metadata?.publishers ?? deal.publishers ?? [],
        releaseDate: metadata?.releaseDate ?? deal.releaseDate ?? null,
        metacriticScore: metadata?.metacriticScore ?? deal.metacriticScore ?? null,
        recommendationsTotal: metadata?.recommendationsTotal ?? deal.recommendationsTotal ?? null,
        screenshots: metadata?.screenshots ?? deal.screenshots ?? [],
        trailerUrl: metadata?.trailerUrl ?? deal.trailerUrl ?? null
      })
    }

    if (newlyResolvedCount > 0) {
      this.sessionLogRepository.log('info', `Metadata nova resolvida pra ${newlyResolvedCount} jogo(s).`)
    }
    return enriched
  }
}
