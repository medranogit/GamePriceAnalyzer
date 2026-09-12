import { useEffect, useState } from 'react'
import { Button, Empty, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import styled from 'styled-components'
import { useQueryClient } from '@tanstack/react-query'
import { useSessionLogEntries, useSessionLogSessions } from '@renderer/hooks/useSessionLog'
import type { SessionLogLevel, SessionLogSession } from '@shared/types'

const { Title, Text } = Typography

const LEVEL_COLORS: Record<SessionLogLevel, string> = {
  info: '#c9d1d9',
  success: '#3fb950',
  warn: '#d4a72c',
  error: '#f85149'
}

const Layout = styled.div`
  display: flex;
  gap: 16px;
  height: calc(100vh - 160px);
`

const SessionList = styled.div`
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  padding-right: 8px;
`

const SessionItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active }) => ($active ? '#fff' : 'inherit')};
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.surfaceRaised)};
  }
`

const StatusDot = styled.span<{ $running: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $running }) => ($running ? '#3fb950' : 'transparent')};
`

const LogPanel = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 12px 16px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
`

const LogLine = styled.div<{ $level: SessionLogLevel }>`
  color: ${({ $level }) => LEVEL_COLORS[$level]};
  white-space: pre-wrap;
  word-break: break-word;
`

function formatSessionLabel(session: SessionLogSession): string {
  return dayjs(session.startedAt).format('DD/MM/YY - HH:mm')
}

export function LogSessaoPage() {
  const { data: sessions = [], isLoading } = useSessionLogSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (selectedId === null && sessions.length > 0) {
      setSelectedId(sessions[0].id)
    }
  }, [sessions, selectedId])

  const { data: entries = [] } = useSessionLogEntries(selectedId)

  const handleReload = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['session-log-sessions'] })
    void queryClient.invalidateQueries({ queryKey: ['session-log-entries'] })
  }

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Log da Sessão
        </Title>
        <Button icon={<ReloadOutlined />} onClick={handleReload}>
          Recarregar
        </Button>
      </div>

      {sessions.length === 0 && !isLoading ? (
        <Empty description="Nenhuma sessão registrada ainda." />
      ) : (
        <Layout>
          <SessionList>
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                type="button"
                $active={session.id === selectedId}
                onClick={() => setSelectedId(session.id)}
              >
                <StatusDot $running={session.status === 'running'} />
                {formatSessionLabel(session)}
              </SessionItem>
            ))}
          </SessionList>

          <LogPanel>
            {entries.length === 0 ? (
              <Text type="secondary">Sem entradas ainda.</Text>
            ) : (
              entries.map((entry, index) => (
                <LogLine key={index} $level={entry.level}>
                  [{dayjs(entry.timestamp).format('HH:mm:ss')}] {entry.message}
                </LogLine>
              ))
            )}
          </LogPanel>
        </Layout>
      )}
    </div>
  )
}
