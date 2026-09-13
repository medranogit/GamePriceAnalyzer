import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const LIBRARY_KEY = ['library']

export function useLibrary() {
  return useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => window.api.library.getCached(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true
  })
}

/** Sincroniza a lista de jogos possuídos e já busca a metadata de quem for novo (tudo do lado do main
 * process, ver SyncLibraryAndResolveNewGames) — também reseta o timer de sincronização automática da
 * biblioteca a partir de agora. */
export function useSyncLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.library.sync(),
    onSuccess: (games) => {
      queryClient.setQueryData(LIBRARY_KEY, games)
      void queryClient.invalidateQueries({ queryKey: ['metadata-cache'] })
    }
  })
}
