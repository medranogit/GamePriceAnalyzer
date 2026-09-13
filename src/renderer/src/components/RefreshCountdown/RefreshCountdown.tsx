import { useEffect, useState } from 'react'
import { Tooltip, Typography } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import styled from 'styled-components'

const { Text } = Typography

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
`

interface RefreshCountdownProps {
  /** `dataUpdatedAt` do useQuery correspondente — quando o cache local foi lido com sucesso pela última vez. */
  dataUpdatedAt: number
  intervalMs?: number
}

/**
 * Contador regressivo pro refetchInterval de uma tela — não dispara nenhuma busca na Steam/GG.deals,
 * só relê o cache local (arquivo já salvo em disco) pra tela acompanhar mudanças (ex: metadata sendo
 * resolvida em segundo plano) sem precisar de F5.
 */
export function RefreshCountdown({ dataUpdatedAt, intervalMs = 60_000 }: RefreshCountdownProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remainingMs = Math.max(dataUpdatedAt + intervalMs - now, 0)
  const remainingSeconds = Math.ceil(remainingMs / 1000)

  return (
    <Tooltip title="Não busca nada novo na Steam/GG.deals — só relê o cache local (o que já foi salvo em disco) pra tela acompanhar sem precisar de F5.">
      <Wrapper>
        <SyncOutlined spin={remainingSeconds === 0} />
        <Text type="secondary">
          {remainingSeconds > 0 ? `Tela atualiza em ${remainingSeconds}s` : 'Atualizando tela...'}
        </Text>
      </Wrapper>
    </Tooltip>
  )
}
