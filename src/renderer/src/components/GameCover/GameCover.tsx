import type { CSSProperties, ReactNode } from 'react'
import styled from 'styled-components'

const CoverDiv = styled.div<{ $url?: string; $height: number; $radius: number }>`
  position: relative;
  flex-shrink: 0;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $radius }) => $radius}px;
  background: ${({ $url, theme }) => ($url ? `url(${$url}) center/cover` : theme.colors.surface)};
`

interface GameCoverProps {
  url?: string
  height?: number
  radius?: number
  style?: CSSProperties
  children?: ReactNode
}

/** Capa de jogo reutilizável (deal cards, gêneros, detalhe do jogo). */
export function GameCover({ url, height = 140, radius = 0, style, children }: GameCoverProps) {
  return (
    <CoverDiv $url={url} $height={height} $radius={radius} style={style}>
      {children}
    </CoverDiv>
  )
}
