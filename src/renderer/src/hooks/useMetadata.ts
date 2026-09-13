import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

export function useMetadataCache() {
  return useQuery({
    queryKey: ['metadata-cache'],
    queryFn: () => window.api.metadata.getAll(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true
  })
}

export const METADATA_RESOLVE_STATUS_KEY = ['metadata-resolve-status']

/**
 * Reflete o estado real do processo principal (ResolveMissingMetadata.isResolving()), não estado local
 * do componente — assim o botão "Cancelar" e o spinner continuam corretos mesmo trocando de aba e
 * voltando pra Configurações enquanto a resolução ainda está rodando em segundo plano.
 */
export function useMetadataResolveStatus() {
  return useQuery({
    queryKey: METADATA_RESOLVE_STATUS_KEY,
    queryFn: () => window.api.metadata.getResolveStatus(),
    refetchInterval: 2_000,
    refetchIntervalInBackground: true
  })
}

export function useResolveGameMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appId: number) => window.api.metadata.resolveOne(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-cache'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['wishlist-deals-cache'] })
    }
  })
}

/** Progresso (capa/screenshots/trailers baixados) de uma busca individual em andamento — só faz sentido
 * ligar `enabled` enquanto o botão "Buscar metadados da Steam" desse jogo estiver com a busca pendente. */
export function useResolveOneProgress(appId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['metadata-resolve-one-progress', appId],
    queryFn: () => window.api.metadata.getResolveOneProgress(appId),
    enabled,
    refetchInterval: 500,
    refetchIntervalInBackground: true
  })
}

export function useGameAchievements(appId: number | null) {
  return useQuery({
    queryKey: ['achievements', appId],
    queryFn: () => window.api.achievements.get(appId as number),
    enabled: appId !== null,
    retry: false
  })
}
