import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useSessionLogSessions() {
  return useQuery({
    queryKey: ['session-log-sessions'],
    queryFn: () => window.api.sessionLog.getSessions(),
    refetchInterval: 5000
  })
}

export function useSessionLogEntries(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-log-entries', sessionId],
    queryFn: () => window.api.sessionLog.getEntries(sessionId as string),
    enabled: sessionId !== null,
    refetchInterval: 3000
  })
}

export function useDeleteSessionLogSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => window.api.sessionLog.deleteSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session-log-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['session-log-entries'] })
    }
  })
}
