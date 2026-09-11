import { useQuery } from '@tanstack/react-query'

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => window.api.history.getEvents()
  })
}
