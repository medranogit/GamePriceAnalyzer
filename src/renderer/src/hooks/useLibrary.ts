import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { METADATA_RESOLVE_STATUS_KEY } from '@renderer/hooks/useMetadata'

const LIBRARY_KEY = ['library']

export function useLibrary() {
  return useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => window.api.library.getCached(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true
  })
}

export function useSyncLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => window.api.library.sync(),
    onSuccess: (games) => {
      queryClient.setQueryData(LIBRARY_KEY, games)

      // Resolve capa/gênero/sinopse só da biblioteca em segundo plano, sem segurar o clique em
      // "Sincronizar" — assim não depende do botão genérico de metadata (Configurações) só pra ver a
      // capa dos próprios jogos. Reaproveita o mesmo `ResolveMissingMetadata` (single-flight): se já
      // tiver uma resolução rodando, essa chamada só acompanha a existente.
      queryClient.setQueryData(METADATA_RESOLVE_STATUS_KEY, { resolving: true })
      void window.api.metadata.resolveMissing('library').finally(() => {
        void queryClient.invalidateQueries({ queryKey: METADATA_RESOLVE_STATUS_KEY })
        void queryClient.invalidateQueries({ queryKey: ['metadata-cache'] })
      })
    }
  })
}
