import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const WISHLIST_KEY = ['wishlist']
const WISHLIST_PRICES_KEY = ['wishlist-prices']

export function useWishlist() {
  return useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: () => window.api.wishlist.getCached()
  })
}

export function useAddWishlistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appId: number) => window.api.wishlist.add(appId),
    onSuccess: (items) => {
      queryClient.setQueryData(WISHLIST_KEY, items)
    }
  })
}

export function useRemoveWishlistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appId: number) => window.api.wishlist.remove(appId),
    onSuccess: (items) => {
      queryClient.setQueryData(WISHLIST_KEY, items)
    }
  })
}

export function useSyncSteamWishlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.wishlist.syncFromSteam(),
    onSuccess: (items) => {
      queryClient.setQueryData(WISHLIST_KEY, items)
    }
  })
}

export function useWishlistPrices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.wishlist.refreshPrices(),
    onSuccess: (prices) => {
      queryClient.setQueryData(WISHLIST_PRICES_KEY, prices)
      queryClient.invalidateQueries({ queryKey: ['wishlist-deals-cache'] })
    }
  })
}
