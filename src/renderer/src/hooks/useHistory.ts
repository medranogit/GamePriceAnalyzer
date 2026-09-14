import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => window.api.history.getEvents()
  })
}

export function useRemoveHistoryEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => window.api.history.removeEvents(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
    }
  })
}
