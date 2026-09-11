import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const SECRETS_KEY = ['secrets-status']

export function useSecretsStatus() {
  return useQuery({
    queryKey: SECRETS_KEY,
    queryFn: () => window.api.secrets.status()
  })
}

export function useSetSteamApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: string) => window.api.secrets.setSteamApiKey(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SECRETS_KEY })
  })
}

export function useSetGGDealsApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: string) => window.api.secrets.setGGDealsApiKey(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SECRETS_KEY })
  })
}
