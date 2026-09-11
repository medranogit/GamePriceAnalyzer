import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/types'

const SETTINGS_KEY = ['settings']

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => window.api.settings.get()
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppSettings>) => window.api.settings.update(partial),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_KEY, updated)
    }
  })
}
