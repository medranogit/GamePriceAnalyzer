import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GameDeal } from '@shared/types'

const DEALS_KEY = ['deals']

export function useDeals() {
  return useQuery({
    queryKey: DEALS_KEY,
    queryFn: () => window.api.deals.getCached()
  })
}

export function useWishlistDealsCache() {
  return useQuery({
    queryKey: ['wishlist-deals-cache'],
    queryFn: () => window.api.deals.getWishlistCached()
  })
}

export function useFetchDeals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.deals.fetch(),
    onSuccess: (deals) => {
      queryClient.setQueryData(DEALS_KEY, deals)
    }
  })
}

export function useDealsFoundListener(onFound: (deal: GameDeal) => void): void {
  useEffect(() => {
    const unsubscribe = window.api.onDealsFound(onFound)
    return unsubscribe
  }, [onFound])
}
