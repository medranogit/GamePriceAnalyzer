import { useQuery } from '@tanstack/react-query'

export const POLLING_STATUS_KEY = ['polling-status']

export function usePollingStatus() {
  return useQuery({
    queryKey: POLLING_STATUS_KEY,
    queryFn: () => window.api.polling.getStatus(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true
  })
}
