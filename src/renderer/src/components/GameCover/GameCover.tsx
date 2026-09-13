import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styled from 'styled-components'

const CoverDiv = styled.div<{ $height: number; $radius: number }>`
  position: relative;
  flex-shrink: 0;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $radius }) => $radius}px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
`

const CoverImg = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const MAX_COVER_RETRIES = 3
const COVER_RETRY_DELAY_MS = 700

interface GameCoverProps {
  url?: string
  height?: number
  radius?: number
  style?: CSSProperties
  children?: ReactNode
}

/** Capa de jogo reutilizável (deal cards, gêneros, detalhe do jogo). */
export function GameCover({ url, height = 140, radius = 0, style, children }: GameCoverProps) {
  const retriesRef = useRef(0)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    retriesRef.current = 0
    setRetryTick(0)
  }, [url])

  const handleError = (): void => {
    if (retriesRef.current < MAX_COVER_RETRIES) {
      retriesRef.current += 1
      setTimeout(() => setRetryTick((tick) => tick + 1), COVER_RETRY_DELAY_MS)
    }
  }

  return (
    <CoverDiv $height={height} $radius={radius} style={style}>
      {url && <CoverImg key={`${url}-${retryTick}`} src={url} alt="" onError={handleError} />}
      {children}
    </CoverDiv>
  )
}
