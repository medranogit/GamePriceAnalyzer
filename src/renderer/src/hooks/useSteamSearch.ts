import { useQuery } from '@tanstack/react-query'

export function useSteamSearch(query: string) {
  return useQuery({
    queryKey: ['steam-search', query],
    queryFn: () => window.api.steam.searchGames(query),
    enabled: query.trim().length >= 2,
    staleTime: 60_000
  })
}
