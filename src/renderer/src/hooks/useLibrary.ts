import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const LIBRARY_KEY = ['library']

export function useLibrary() {
  return useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => window.api.library.getCached(),
    refetchInterval: 60_000
  })
}

export function useSyncLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.library.sync(),
    onSuccess: (games) => {
      queryClient.setQueryData(LIBRARY_KEY, games)
    }
  })
}
