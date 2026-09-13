import { Typography } from 'antd'
import dayjs from 'dayjs'
import styled from 'styled-components'
import type { SessionLogEntry, SessionLogLevel } from '@shared/types'

const { Text } = Typography

const LEVEL_COLORS: Record<SessionLogLevel, string> = {
  info: '#c9d1d9',
  success: '#3fb950',
  warn: '#d4a72c',
  error: '#f85149'
}

const LogLine = styled.div<{ $level: SessionLogLevel }>`
  color: ${({ $level }) => LEVEL_COLORS[$level]};
  white-space: pre-wrap;
  word-break: break-word;
`

interface SessionLogLinesProps {
  entries: SessionLogEntry[]
  emptyMessage?: string
}

export function SessionLogLines({ entries, emptyMessage = 'Sem entradas ainda.' }: SessionLogLinesProps) {
  if (entries.length === 0) {
    return <Text type="secondary">{emptyMessage}</Text>
  }

  return (
    <>
      {entries.map((entry, index) => (
        <LogLine key={index} $level={entry.level}>
          [{dayjs(entry.timestamp).format('HH:mm:ss')}] {entry.message}
        </LogLine>
      ))}
    </>
  )
}
