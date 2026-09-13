import { useEffect, useState } from 'react'
import { Button, Empty, Popconfirm, Typography } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import styled from 'styled-components'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDeleteSessionLogSession,
  useSessionLogEntries,
  useSessionLogSessions
} from '@renderer/hooks/useSessionLog'
import { SessionLogLines } from '@renderer/components/SessionLogLines/SessionLogLines'
import type { SessionLogSession } from '@shared/types'

const { Title } = Typography

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

const SessionRow = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.surfaceRaised)};
  }

  &:hover button[data-delete] {
    opacity: 1;
  }
`

const SessionItem = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  background: transparent;
  color: ${({ $active }) => ($active ? '#fff' : 'inherit')};
  border: none;
  padding: 10px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
`

const DeleteButton = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${({ $active }) => ($active ? '#fff' : 'inherit')};
  opacity: 0;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
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

function formatSessionLabel(session: SessionLogSession): string {
  return dayjs(session.startedAt).format('DD/MM/YY - HH:mm')
}

export function LogSessaoPage() {
  const { data: sessions = [], isLoading } = useSessionLogSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const deleteSession = useDeleteSessionLogSession()

  useEffect(() => {
    if (selectedId === null && sessions.length > 0) {
      setSelectedId(sessions[0].id)
    }
  }, [sessions, selectedId])

  const { data: entries = [] } = useSessionLogEntries(selectedId)
  const entriesNewestFirst = [...entries].reverse()

  const handleReload = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['session-log-sessions'] })
    void queryClient.invalidateQueries({ queryKey: ['session-log-entries'] })
  }

  const handleDelete = (sessionId: string): void => {
    deleteSession.mutate(sessionId)
    if (sessionId === selectedId) {
      setSelectedId(null)
    }
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
            {sessions.map((session) => {
              const isActive = session.id === selectedId
              return (
                <SessionRow key={session.id} $active={isActive}>
                  <SessionItem type="button" $active={isActive} onClick={() => setSelectedId(session.id)}>
                    <StatusDot $running={session.status === 'running'} />
                    {formatSessionLabel(session)}
                  </SessionItem>
                  <Popconfirm
                    title="Excluir esta sessão de log?"
                    okText="Excluir"
                    cancelText="Cancelar"
                    onConfirm={() => handleDelete(session.id)}
                  >
                    <DeleteButton type="button" data-delete $active={isActive}>
                      <DeleteOutlined />
                    </DeleteButton>
                  </Popconfirm>
                </SessionRow>
              )
            })}
          </SessionList>

          <LogPanel>
            <SessionLogLines entries={entriesNewestFirst} />
          </LogPanel>
        </Layout>
      )}
    </div>
  )
}
