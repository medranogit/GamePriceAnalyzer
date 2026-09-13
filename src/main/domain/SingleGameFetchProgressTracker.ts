export interface FetchProgressStatus {
  completed: number
  total: number
}

/**
 * Progresso (em memória, não persiste) de uma busca de metadata de UM jogo por vez — usado só pra dar
 * feedback visual de "quantos arquivos já baixei" enquanto `LocalImageCachingGameMetadataRepository`/
 * `LocalTrailerCachingGameMetadataRepository` baixam capa, screenshots e trailers daquele AppID. `total`
 * começa em 0 e só cresce conforme cada decorator descobre quantos itens tem pra baixar (a metadata da
 * Steam só chega depois do fetchMetadata interno) — se nenhum dos dois toggles de download local estiver
 * ligado, `total` fica em 0 pra sempre, e quem lê o status trata isso como "sem progresso pra mostrar".
 */
export class SingleGameFetchProgressTracker {
  private readonly statusByAppId = new Map<number, FetchProgressStatus>()

  start(appId: number): void {
    this.statusByAppId.set(appId, { completed: 0, total: 0 })
  }

  addTotal(appId: number, amount: number): void {
    const current = this.statusByAppId.get(appId)
    if (current) current.total += amount
  }

  addCompleted(appId: number): void {
    const current = this.statusByAppId.get(appId)
    if (current) current.completed += 1
  }

  finish(appId: number): void {
    this.statusByAppId.delete(appId)
  }

  getStatus(appId: number): FetchProgressStatus | null {
    return this.statusByAppId.get(appId) ?? null
  }
}
