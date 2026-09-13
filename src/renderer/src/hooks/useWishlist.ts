import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const WISHLIST_KEY = ['wishlist']

export function useWishlist() {
  return useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: () => window.api.wishlist.getCached()
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
