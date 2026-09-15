import { useQuery } from '@tanstack/react-query'

export function useGGDealsQueue() {
  return useQuery({
    queryKey: ['queues', 'gg-deals'],
    queryFn: () => window.api.queues.getGGDeals(),
    refetchInterval: 500,
    refetchIntervalInBackground: true
  })
}

export function useSteamMetadataQueue() {
  return useQuery({
    queryKey: ['queues', 'steam-metadata'],
    queryFn: () => window.api.queues.getSteamMetadata(),
    refetchInterval: 500,
    refetchIntervalInBackground: true
  })
}

export function useGGDealsQuota() {
  return useQuery({
    queryKey: ['queues', 'gg-deals-quota'],
    queryFn: () => window.api.queues.getGGDealsQuota(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true
  })
}

export function useTimersStatus() {
  return useQuery({
    queryKey: ['timers'],
    queryFn: () => window.api.timers.getAll(),
    refetchInterval: 1_000,
    refetchIntervalInBackground: true
  })
}
