import { useQuery } from '@tanstack/react-query'

export function usePollingStatus() {
  return useQuery({
    queryKey: ['polling-status'],
    queryFn: () => window.api.polling.getStatus(),
    refetchInterval: 10_000
  })
}
