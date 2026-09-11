export interface SteamSpecialCandidate {
  appId: number
  name: string
  discountPercent: number
  headerImageUrl: string | null
}

/**
 * Fonte de descoberta do modo "todas as ofertas": jogos atualmente em promoção
 * na própria Steam, usados como universo de candidatos para depois cruzar
 * com o GG.deals (multi-loja) e aplicar os filtros do usuário.
 */
export interface SteamSpecialsRepository {
  fetchCurrentSpecials(): Promise<SteamSpecialCandidate[]>
}
