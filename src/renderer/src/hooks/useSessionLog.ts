import { useQuery } from '@tanstack/react-query'

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
