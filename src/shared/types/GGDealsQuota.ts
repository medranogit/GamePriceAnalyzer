export interface GGDealsQuotaStatus {
  /** Último `remaining` visto num header de resposta real — null se o app nunca chamou a API ainda
   * nesta sessão (não persiste entre reinícios, é só uma estimativa de "agora"). */
  remaining: number | null
  limit: number
  checkedAt: string | null
}
