import { Tag } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import { GameCover } from '@renderer/components/GameCover/GameCover'

const CardWrapper = styled.div`
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
  display: flex;
  flex-direction: column;
  height: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const Body = styled.div`
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
`

const GameTitle = styled.div`
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: calc(1.3em * 2);
`

const GenreRow = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  min-height: 22px;
`

const PlaytimeRow = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`

export interface LibraryGameCardData {
  appId: number
  title: string
  coverUrl?: string
  genres: string[]
  playtimeForeverMinutes: number
}

interface LibraryGameCardProps {
  game: LibraryGameCardData
}

export function LibraryGameCard({ game }: LibraryGameCardProps) {
  const navigate = useNavigate()
  const hours = game.playtimeForeverMinutes / 60

  return (
    <CardWrapper onClick={() => navigate(`/library/${game.appId}`)}>
      <GameCover url={game.coverUrl} height={140} />

      <Body>
        <GameTitle title={game.title}>{game.title}</GameTitle>

        <GenreRow>
          {game.genres.slice(0, 2).map((genre) => (
            <Tag key={genre} style={{ margin: 0 }}>
              {genre}
            </Tag>
          ))}
        </GenreRow>

        <PlaytimeRow>
          <ClockCircleOutlined />
          {hours > 0 ? `${hours.toFixed(1)}h jogadas` : 'Nunca jogado'}
        </PlaytimeRow>
      </Body>
    </CardWrapper>
  )
}
