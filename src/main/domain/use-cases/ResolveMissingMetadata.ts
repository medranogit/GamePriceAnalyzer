import type { AppCacheRepository } from '../repositories/AppCacheRepository'
import type { GameMetadataRepository } from '../repositories/GameMetadataRepository'
import type { HistoryRepository } from '../repositories/HistoryRepository'
import type { SessionLogRepository } from '../repositories/SessionLogRepository'
import { syncAllCachedDeals, syncCachedDealsForAppId } from '../dealMetadataSync'
import { isMetadataIncomplete } from '../isMetadataIncomplete'
import { describeMetadata } from '../describeMetadata'

const MAX_CONSECUTIVE_FAILURES = 3

export interface ResolveMissingMetadataResult {
  resolved: number
  failed: number
  synced: number
}

/** 'all' = wishlist + biblioteca (padrão, botão em Configurações). 'library' = só biblioteca (botão de sincronizar em Minha Biblioteca e o ciclo automático de ofertas). */
export type ResolveMissingMetadataScope = 'all' | 'library'

/**
 * Resolve capa/gênero/sinopse/trailer da Steam pra quem ainda não tem isso em
 * cache. Por padrão (`scope: 'all'`) cobre wishlist + biblioteca, sem
 * duplicar quem está nas duas listas — é o que roda pelo botão em
 * Configurações. Com `scope: 'library'`, só considera jogos possuídos — tanto
 * o botão "Sincronizar com a Steam" da tela Minha Biblioteca (na hora, depois
 * de atualizar a lista) quanto o ciclo automático de busca de ofertas (a cada
 * `polling.intervalMinutes`, junto com o backfill de wishlist que o
 * `FetchOwnableDeals` já faz sozinho) disparam isso, pra manter a metadata da
 * biblioteca completa sem precisar do botão manual.
 *
 * Sincroniza o cache de ofertas (Dashboard e Wishlist) a cada jogo resolvido
 * — não só no final — pra quem estiver de olho na tela ver o progresso
 * conforme roda, já que essa operação pode levar bastante tempo (1,5s por
 * jogo, respeitando o rate limit da Steam).
 */
export class ResolveMissingMetadata {
  private inFlight: Promise<ResolveMissingMetadataResult> | null = null
  private cancelled = false
  // Em memória (zera ao reiniciar o app, de propósito — dá uma nova chance depois de um restart) —
  // conta falhas consecutivas *entre ciclos* de backfill pra cada AppID. 3 falhas espaçadas por ciclos
  // inteiros (não tentativas rápidas seguidas) é um sinal forte de que o jogo saiu da loja da Steam, não
  // uma falha de rede passageira. Quem entra em `unresolvable` para de ser tentado automaticamente, pra
  // não desperdiçar chamada/tempo com o mesmo jogo morto pra sempre.
  private readonly consecutiveFailures = new Map<number, number>()
  private readonly unresolvable = new Set<number>()

  constructor(
    private readonly cacheRepository: AppCacheRepository,
    private readonly metadataRepository: GameMetadataRepository,
    private readonly sessionLogRepository: SessionLogRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  execute(scope: ResolveMissingMetadataScope = 'all'): Promise<ResolveMissingMetadataResult> {
    if (this.inFlight) return this.inFlight
    this.cancelled = false
    this.inFlight = this.run(scope).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /** Para a resolução em andamento assim que possível — termina o jogo atual, mas não começa o próximo. */
  cancel(): void {
    this.cancelled = true
  }

  isResolving(): boolean {
    return this.inFlight !== null
  }

  private async run(scope: ResolveMissingMetadataScope): Promise<ResolveMissingMetadataResult> {
    const targetsByAppId = new Map<number, { appId: number; title: string }>()
    if (scope === 'all') {
      for (const item of this.cacheRepository.getWishlist()) {
        targetsByAppId.set(item.appId, { appId: item.appId, title: item.title })
      }
    }
    for (const game of this.cacheRepository.getOwnedGames()) {
      targetsByAppId.set(game.appId, { appId: game.appId, title: game.name })
    }
    // DLC de jogo possuído entra como alvo de metadata mesmo sem estar em `FetchOwnableDeals` (isso só
    // acontece pra DLC que a Steam, por acaso, também lista como possuída) — sem isso, essa DLC nunca
    // teria título/capa resolvidos pra exibir na tela de detalhe da Biblioteca.
    for (const game of this.cacheRepository.getOwnedGames()) {
      const gameMetadata = this.cacheRepository.getMetadata(game.appId)
      for (const dlcAppId of gameMetadata?.dlcAppIds ?? []) {
        if (!targetsByAppId.has(dlcAppId)) {
          targetsByAppId.set(dlcAppId, { appId: dlcAppId, title: `DLC ${dlcAppId}` })
        }
      }
    }
    const incomplete = [...targetsByAppId.values()].filter((item) =>
      isMetadataIncomplete(this.cacheRepository.getMetadata(item.appId))
    )
    const missing = incomplete.filter((item) => !this.unresolvable.has(item.appId))
    const skippedUnresolvableCount = incomplete.length - missing.length

    const scopeLabel = scope === 'library' ? 'biblioteca' : 'wishlist + biblioteca'
    this.sessionLogRepository.log(
      'info',
      `Resolvendo metadata da Steam (${scopeLabel}): ${missing.length} jogo(s) sem metadata completa em cache${skippedUnresolvableCount > 0 ? ` (${skippedUnresolvableCount} marcado(s) como não resolvível ignorado(s))` : ''}.`
    )

    let resolved = 0
    let failed = 0
    let synced = 0

    let processed = 0
    for (const item of missing) {
      if (this.cancelled) break

      this.sessionLogRepository.log('info', `Buscando metadata da Steam pra "${item.title}"...`)
      const metadata = await this.metadataRepository.fetchMetadata(item.appId)
      processed += 1
      if (metadata) {
        this.cacheRepository.setMetadata(metadata)
        resolved += 1
        this.consecutiveFailures.delete(item.appId)
        synced += syncCachedDealsForAppId(this.cacheRepository, item.appId, metadata)
        const message = `Metadata resolvida pra "${item.title}": ${describeMetadata(metadata)}.`
        this.sessionLogRepository.log('success', message)
        this.historyRepository.addEvent('metadata_backfill', message, item.appId)
      } else {
        failed += 1
        const failureCount = (this.consecutiveFailures.get(item.appId) ?? 0) + 1
        if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
          this.consecutiveFailures.delete(item.appId)
          this.unresolvable.add(item.appId)
          this.sessionLogRepository.log(
            'warn',
            `"${item.title}" (AppID ${item.appId}) falhou ${failureCount}x seguidas no backfill — marcado como não resolvível, não tenta mais automaticamente até o app reiniciar.`
          )
        } else {
          this.consecutiveFailures.set(item.appId, failureCount)
          this.sessionLogRepository.log(
            'warn',
            `Não consegui metadata da Steam pra "${item.title}" (${failureCount}/${MAX_CONSECUTIVE_FAILURES} falha(s) seguida(s)).`
          )
        }
      }
    }

    // Rede de segurança: cobre metadata que já estava completa em cache antes
    // desta execução (então nunca passou pelo loop acima) mas nunca tinha
    // sido aplicada nas ofertas cacheadas.
    synced += syncAllCachedDeals(this.cacheRepository)

    if (this.cancelled) {
      this.sessionLogRepository.log(
        'warn',
        `Backfill de metadata (${scopeLabel}) cancelado: ${processed}/${missing.length} jogo(s) processado(s) (${resolved} resolvido(s), ${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s) com a metadata.`
      )
      return { resolved, failed, synced }
    }

    this.sessionLogRepository.log(
      'success',
      `Backfill de metadata (${scopeLabel}) concluído: ${resolved}/${missing.length} jogo(s) (${failed} falha(s)). ${synced} oferta(s) em cache sincronizada(s) com a metadata.`
    )
    return { resolved, failed, synced }
  }
}
