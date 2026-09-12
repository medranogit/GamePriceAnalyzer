import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GameDeal } from '@shared/types'

const DEALS_KEY = ['deals']

/**
 * Não há busca manual — o processo principal já atualiza esse cache sozinho
 * (assim que o app abre, e depois a cada intervalo configurado). Refaz a
 * leitura do cache local periodicamente pra essa tela acompanhar sem precisar
 * de F5/remount; é leitura local via IPC, não bate na rede.
 */
export function useDeals() {
  return useQuery({
    queryKey: DEALS_KEY,
    queryFn: () => window.api.deals.getCached(),
    refetchInterval: 60_000
  })
}

export function useWishlistDealsCache() {
  return useQuery({
    queryKey: ['wishlist-deals-cache'],
    queryFn: () => window.api.deals.getWishlistCached(),
    refetchInterval: 60_000
  })
}

export function useDealsFoundListener(onFound: (deal: GameDeal) => void): void {
  useEffect(() => {
    const unsubscribe = window.api.onDealsFound(onFound)
    return unsubscribe
  }, [onFound])
}
