import { useEffect, useState } from 'react'
import { Tooltip, Typography } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import dayjs from 'dayjs'
import { usePollingStatus } from '@renderer/hooks/usePollingStatus'

const { Text } = Typography

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
`

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'a qualquer momento'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (hours > 0 || minutes > 0) parts.push(`${minutes}min`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

/** Mostra quando foi a última busca de ofertas e um contador regressivo pra próxima, com base em `polling:getStatus` (lastRunAt + intervalMinutes). */
export function PollingStatus() {
  const { data } = usePollingStatus()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!data) return null

  const lastRunAt = data.lastRunAt ? dayjs(data.lastRunAt) : null
  const nextRunAtMs = data.lastRunAt
    ? new Date(data.lastRunAt).getTime() + data.intervalMinutes * 60_000
    : null
  const remainingMs = nextRunAtMs !== null ? nextRunAtMs - now : 0

  return (
    <Wrapper>
      <ClockCircleOutlined />
      <Tooltip title={lastRunAt ? lastRunAt.format('DD/MM/YYYY HH:mm:ss') : 'Ainda não rodou'}>
        <Text type="secondary">Última busca: {lastRunAt ? lastRunAt.format('HH:mm') : '—'}</Text>
      </Tooltip>
      <Text type="secondary">·</Text>
      <Text type="secondary">Próxima em: {nextRunAtMs !== null ? formatCountdown(remainingMs) : '—'}</Text>
    </Wrapper>
  )
}
