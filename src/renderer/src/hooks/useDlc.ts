import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useManuallyOwnedDlc() {
  return useQuery({
    queryKey: ['dlc-manually-owned'],
    queryFn: () => window.api.dlc.getManuallyOwned()
  })
}

export function useSetDlcManualOwnership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appId, owned }: { appId: number; owned: boolean }) =>
      window.api.dlc.setManuallyOwned(appId, owned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlc-manually-owned'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    }
  })
}
