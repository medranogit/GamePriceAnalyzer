import { useQuery } from '@tanstack/react-query'

export function useMetadataCache() {
  return useQuery({
    queryKey: ['metadata-cache'],
    queryFn: () => window.api.metadata.getAll(),
    refetchInterval: 60_000
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
