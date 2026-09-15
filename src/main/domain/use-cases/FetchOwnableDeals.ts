import type { GameDeal } from '@shared/types'
import { preserveFirstSeenAt } from '../dealOrdering'
import type { DealsRepository } from '../repositories/DealsRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { PriceHistoryRepository } from '../repositories/PriceHistoryRepository'
import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import type { SettingsRepository } from '../repositories/SettingsRepository'
import { isMetadataIncomplete } from '../isMetadataIncomplete'
import { describeMetadata } from '../describeMetadata'

function formatDealPrice(deal: GameDeal, price: number | null): string {
  return price === null ? 'sem oferta' : `${deal.currency ?? ''} ${price.toFixed(2)}`.trim()
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
 *
 * Cada lote do GG.deals é salvo (preço + metadata) assim que chega, e o AppID
 * sai da lista de "pendentes" (`deals-fetch-progress.json`) na hora — se o app
 * fechar no meio de uma busca grande, ou se o rate limit do GG.deals acabar
 * no meio do ciclo (`GGDealsApiClient` para de enviar lotes nesse caso), a
 * próxima chamada a `execute()` retoma só o que ainda falta, priorizando
 * quem ficou de fora, em vez de recomeçar do primeiro AppID.
 */
export class FetchOwnableDeals {
  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly cacheRepository: AppCacheRepository,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly settingsRepository: SettingsRepository
  ) {}

  async execute(): Promise<GameDeal[]> {
    const ownedAppIds = new Set(this.cacheRepository.getOwnedGames().map((g) => g.appId))
    const wishlistAppIds = this.cacheRepository.getWishlist().map((w) => w.appId)
    // DLC de jogo já possuído na Biblioteca entra como candidato mesmo sem estar na wishlist (a Steam
    // não permite isso pra DLC) — a própria metadata do jogo base já lista os AppIDs de DLC dele
    // (`dlcAppIds`), preenchida pelo backfill de metadata que já roda de qualquer forma.
    const dlcCandidateAppIds = this.cacheRepository
      .getAllMetadata()
      .filter((metadata) => ownedAppIds.has(metadata.appId))
      .flatMap((metadata) => metadata.dlcAppIds ?? [])
    const allCandidateAppIds = [...new Set([...wishlistAppIds, ...dlcCandidateAppIds])]
    const candidateAppIds = allCandidateAppIds.filter((appId) => !ownedAppIds.has(appId))
    const ownedSkippedCount = allCandidateAppIds.length - candidateAppIds.length
    const candidateSet = new Set(candidateAppIds)

    this.sessionLogRepository.log(
      'info',
      `Candidatos: ${candidateAppIds.length} jogo(s)/DLC(s) da wishlist e biblioteca (${ownedSkippedCount} já possuído(s) descartado(s)).`
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
    const fullToFetch = isResuming ? filteredPending : candidateAppIds

    // Limite de AppIDs por ciclo automático (configurável, `polling.maxDealsPerCycle`) — deixa uma
    // reserva do limite de 1000 registros/hora da conta pra forçar buscas manuais sem estourar a cota.
    // Quem passa do limite fica pendente e entra primeiro no próximo ciclo, igual a uma pausa por
    // rate limit — não precisa de lógica extra além de reaproveitar `pendingDealsAppIds`.
    const { maxDealsPerCycle, dealsBatchCount } = this.settingsRepository.get().polling
    // Tamanho de cada lote derivado de "em quantos lotes dividir" — arredondado pra cima, e sempre
    // clampado ao limite real da API (100) dentro do GGDealsApiClient, então nunca estoura mesmo com
    // `dealsBatchCount` baixo (ex: 1) num ciclo grande.
    const dealsBatchSize = Math.ceil(maxDealsPerCycle / Math.max(1, dealsBatchCount))
    const toFetch = fullToFetch.slice(0, maxDealsPerCycle)
    const deferredByLimit = fullToFetch.slice(maxDealsPerCycle)
    this.cacheRepository.setPendingDealsAppIds([...toFetch, ...deferredByLimit])

    if (isResuming) {
      this.sessionLogRepository.log(
        'warn',
        `Retomando busca de ofertas: ${fullToFetch.length}/${candidateAppIds.length} jogo(s) ainda faltam (interrompida ou limitada pelo rate limit do ciclo anterior).`
      )
    }
    if (deferredByLimit.length > 0) {
      this.sessionLogRepository.log(
        'info',
        `Limite de ${maxDealsPerCycle} jogo(s) por ciclo: ${deferredByLimit.length} ficam pra próxima busca (reserva de cota pra buscas manuais).`
      )
    }

    const pending = new Set(toFetch)
    let priceChangedCount = 0
    const { processedAppIdCount } = await this.dealsRepository.fetchDealsBySteamAppIds(
      toFetch,
      dealsBatchSize,
      async (batchDeals, requestedAppIds) => {
        priceChangedCount += await this.processBatch(batchDeals)
        // Remove TODO o lote pedido da lista de pendentes, não só quem teve preço na resposta — um
        // AppID que a GG.deals não rastreia (resposta vazia, mas bem-sucedida) precisa contar como
        // processado também, senão fica preso pra sempre e trava o ciclo pros outros candidatos.
        for (const appId of requestedAppIds) {
          pending.delete(appId)
        }
        this.cacheRepository.setPendingDealsAppIds([...pending, ...deferredByLimit])
      }
    )

    if (processedAppIdCount < toFetch.length) {
      this.sessionLogRepository.log(
        'warn',
        `Ciclo parcial: ${processedAppIdCount}/${toFetch.length} jogo(s) consultados no GG.deals. O restante entra primeiro no próximo ciclo.`
      )
    }

    // Logado só agora, depois de processar todos os lotes — assim esse resumo fica com o timestamp
    // mais recente do ciclo e aparece no topo do grupo no Histórico (mais novo primeiro), com os
    // "Nova oferta"/"Preço atualizado" individuais logo abaixo como detalhe.
    const finalDeals = this.cacheRepository.getDeals()
    const summary = `Busca de ofertas concluída: ${finalDeals.length} oferta(s) em cache, ${priceChangedCount} preço(s) mudaram nesse ciclo.`
    this.sessionLogRepository.log('success', summary)
    this.historyRepository.addEvent('offers_sync', summary)
    return finalDeals
  }

  /** Salva preço/histórico/metadata de um lote assim que ele chega, e mescla no cache sem apagar o resto. */
  private async processBatch(batchDeals: GameDeal[]): Promise<number> {
    const previousDeals = this.cacheRepository.getDeals()
    const previousByAppId = new Map(
      previousDeals.filter((deal) => deal.appId !== null).map((deal) => [deal.appId, deal])
    )
    const previousAppIds = new Set(previousByAppId.keys())
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

    const priceChangedCount = this.logPriceChanges(withFirstSeen, previousByAppId)

    const enriched = await this.enrichWithMetadata(withFirstSeen, previousAppIds)

    const dealsByAppId = new Map(
      previousDeals.filter((deal) => deal.appId !== null).map((deal) => [deal.appId, deal])
    )
    for (const deal of enriched) {
      if (deal.appId !== null) dealsByAppId.set(deal.appId, deal)
    }
    this.cacheRepository.setDeals([...dealsByAppId.values()])
    return priceChangedCount
  }

  /**
   * Loga jogo a jogo quem teve o preço (loja ou keyshop) realmente alterado neste ciclo — sem isso, uma
   * atualização de preço em oferta já conhecida passava batido no log, só contando pro total final.
   * Oferta genuinamente nova (sem entrada anterior) não entra aqui: ela já ganha seu próprio log em
   * `enrichWithMetadata`.
   */
  private logPriceChanges(deals: GameDeal[], previousByAppId: Map<number | null, GameDeal>): number {
    let changedCount = 0

    for (const deal of deals) {
      if (deal.appId === null) continue
      const previous = previousByAppId.get(deal.appId)
      if (!previous) continue

      const parts: string[] = []
      if (previous.currentRetailPrice !== deal.currentRetailPrice) {
        parts.push(
          `loja ${formatDealPrice(deal, previous.currentRetailPrice)} → ${formatDealPrice(deal, deal.currentRetailPrice)}`
        )
      }
      if (previous.currentKeyshopPrice !== deal.currentKeyshopPrice) {
        parts.push(
          `keyshop ${formatDealPrice(deal, previous.currentKeyshopPrice)} → ${formatDealPrice(deal, deal.currentKeyshopPrice)}`
        )
      }
      if (parts.length === 0) continue

      changedCount += 1
      const message = `Preço atualizado pra "${deal.title}": ${parts.join(', ')}.`
      this.sessionLogRepository.log('info', message)
      this.historyRepository.addEvent('offers_sync', message, deal.appId)
    }

    return changedCount
  }

  /**
   * Só busca metadata da Steam pra oferta genuinamente nova (appId sem deal cacheado antes) — oferta já
   * existente só tem o preço atualizado aqui. Preencher metadata faltando de quem já existe é
   * responsabilidade do backfill dedicado (`ResolveMissingMetadata`, próprio timer).
   */
  private async enrichWithMetadata(
    deals: GameDeal[],
    previousAppIds: Set<number | null>
  ): Promise<GameDeal[]> {
    const enriched: GameDeal[] = []
    let newlyResolvedCount = 0

    for (const deal of deals) {
      if (deal.appId === null) {
        enriched.push(deal)
        continue
      }

      const isNewDeal = !previousAppIds.has(deal.appId)
      if (isNewDeal) {
        this.historyRepository.addEvent('offers_sync', `Nova oferta: "${deal.title}".`, deal.appId)
      }
      const cached = this.cacheRepository.getMetadata(deal.appId)
      const needsFetch = isNewDeal && isMetadataIncomplete(cached)
      if (needsFetch) {
        this.sessionLogRepository.log(
          'info',
          `Buscando metadata da Steam pra "${deal.title}" (oferta nova)...`
        )
        newlyResolvedCount += 1
      }
      const metadata = needsFetch ? await this.metadataRepository.fetchMetadata(deal.appId) : cached
      if (metadata && needsFetch) {
        this.cacheRepository.setMetadata(metadata)
        this.sessionLogRepository.log(
          'success',
          `Metadata resolvida pra "${deal.title}": ${describeMetadata(metadata)}.`
        )
      }
      if (!metadata && needsFetch) {
        this.sessionLogRepository.log(
          'warn',
          `Não consegui metadata da Steam pra "${deal.title}" — o backfill tenta de novo depois.`
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
        trailers: metadata?.trailers ?? deal.trailers ?? [],
        isDlc: metadata?.isDlc ?? deal.isDlc ?? false,
        parentAppId: metadata?.parentAppId ?? deal.parentAppId ?? null
      })
    }

    if (newlyResolvedCount > 0) {
      this.sessionLogRepository.log('info', `Metadata nova resolvida pra ${newlyResolvedCount} jogo(s).`)
    }
    return enriched
  }
}
