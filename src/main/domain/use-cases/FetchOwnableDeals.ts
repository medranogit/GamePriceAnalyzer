import type { GameDeal } from '@shared/types'
import { preserveFirstSeenAt } from '../dealOrdering'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'

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
 *
 * Cada lote do GG.deals é salvo (preço + metadata) assim que chega, e o AppID
 * sai da lista de "pendentes" (`deals-fetch-progress.json`) na hora — se o app
 * fechar no meio de uma busca grande (ex: lote 6/12), a próxima chamada a
 * `execute()` retoma só o que ainda falta, em vez de recomeçar do lote 1.
 * Isso é por-ciclo: assim que um ciclo termina (pendentes zera), a próxima
 * chamada começa um ciclo novo do zero (preço precisa ser sempre reconferido).
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
    const candidateAppIds = allCandidateAppIds.filter((appId) => !ownedAppIds.has(appId))
    const ownedSkippedCount = allCandidateAppIds.length - candidateAppIds.length
    const candidateSet = new Set(candidateAppIds)

    this.sessionLogRepository.log(
      'info',
      `Candidatos: ${candidateAppIds.length} jogo(s) da wishlist (${ownedSkippedCount} já possuído(s) descartado(s)).`
    )

    // Remove do cache quem não é mais candidato (saiu da wishlist ou foi adquirido).
    const currentDeals = this.cacheRepository.getDeals()
    const cleanedDeals = currentDeals.filter((deal) => deal.appId !== null && candidateSet.has(deal.appId))
    if (cleanedDeals.length !== currentDeals.length) {
      this.cacheRepository.setDeals(cleanedDeals)
    }

    if (candidateAppIds.length === 0) {
      this.cacheRepository.setPendingDealsAppIds([])
      return []
    }

    const filteredPending = this.cacheRepository
      .getPendingDealsAppIds()
      .filter((appId) => candidateSet.has(appId))
    const isResuming = filteredPending.length > 0
    const toFetch = isResuming ? filteredPending : candidateAppIds
    this.cacheRepository.setPendingDealsAppIds(toFetch)

    if (isResuming) {
      this.sessionLogRepository.log(
        'warn',
        `Retomando busca de ofertas interrompida: ${toFetch.length}/${candidateAppIds.length} jogo(s) ainda faltam.`
      )
    }

    const pending = new Set(toFetch)
    await this.dealsRepository.fetchDealsBySteamAppIds(toFetch, async (batchDeals) => {
      await this.processBatch(batchDeals)
      for (const deal of batchDeals) {
        if (deal.appId !== null) pending.delete(deal.appId)
      }
      this.cacheRepository.setPendingDealsAppIds([...pending])
    })

    const finalDeals = this.cacheRepository.getDeals()
    this.sessionLogRepository.log('success', `Concluído: ${finalDeals.length} oferta(s) atualizada(s).`)
    return finalDeals
  }

  /** Salva preço/histórico/metadata de um lote assim que ele chega, e mescla no cache sem apagar o resto. */
  private async processBatch(batchDeals: GameDeal[]): Promise<void> {
    const previousDeals = this.cacheRepository.getDeals()
    const withFirstSeen = preserveFirstSeenAt(batchDeals, previousDeals)

    for (const deal of withFirstSeen) {
      if (deal.appId === null) continue
      this.priceHistoryRepository.recordObservation(
        deal.appId,
        deal.currency,
        deal.currentRetailPrice,
        deal.currentKeyshopPrice
      )
    }

    const enriched = await this.enrichWithMetadata(withFirstSeen)

    const dealsByAppId = new Map(
      previousDeals.filter((deal) => deal.appId !== null).map((deal) => [deal.appId, deal])
    )
    for (const deal of enriched) {
      if (deal.appId !== null) dealsByAppId.set(deal.appId, deal)
    }
    this.cacheRepository.setDeals([...dealsByAppId.values()])
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
        trailers: metadata?.trailers ?? deal.trailers ?? []
      })
    }

    if (newlyResolvedCount > 0) {
      this.sessionLogRepository.log('info', `Metadata nova resolvida pra ${newlyResolvedCount} jogo(s).`)
    }
    return enriched
  }
}
