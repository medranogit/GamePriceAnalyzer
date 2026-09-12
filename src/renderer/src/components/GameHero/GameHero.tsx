import { Image, Tag, Typography } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { GameCover } from '@renderer/components/GameCover/GameCover'
import { formatCount } from '@renderer/lib/formatters'

const { Title, Text } = Typography

const Hero = styled.div`
  position: relative;
  margin-bottom: 16px;
`

const HeroScrim = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: linear-gradient(to top, rgba(15, 17, 21, 0.95), rgba(15, 17, 21, 0) 55%);
`

const HeroTitle = styled(Title)`
  &&& {
    position: absolute;
    left: 20px;
    bottom: 14px;
    margin: 0;
    color: #fff;
  }
`

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`

const GenresRow = styled.div`
  margin-bottom: 16px;
`

const Trailer = styled.video`
  display: block;
  width: 100%;
  max-height: 420px;
  border-radius: 10px;
  margin-bottom: 20px;
  background: #000;
`

const ScreenshotsRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 20px;
  padding-bottom: 4px;
`

function metacriticColor(score: number): string {
  if (score >= 75) return '#3fb950'
  if (score >= 50) return '#d4a72c'
  return '#f85149'
}

interface GameHeroProps {
  title: string
  coverUrl?: string
  genres: string[]
  developers: string[]
  publishers: string[]
  releaseDate: string | null
  metacriticScore: number | null
  recommendationsTotal: number | null
  shortDescription: string | null
  trailerUrl: string | null
  screenshots: string[]
}

export function GameHero({
  title,
  coverUrl,
  genres,
  developers,
  publishers,
  releaseDate,
  metacriticScore,
  recommendationsTotal,
  shortDescription,
  trailerUrl,
  screenshots
}: GameHeroProps) {
  const metaParts: string[] = []
  if (developers.length > 0) metaParts.push(developers.join(', '))
  if (publishers.length > 0 && publishers.join(',') !== developers.join(','))
    metaParts.push(publishers.join(', '))
  if (releaseDate) metaParts.push(releaseDate)

  return (
    <>
      <Hero>
        <GameCover url={coverUrl} height={260} radius={10} />
        <HeroScrim />
        <HeroTitle level={2}>{title}</HeroTitle>
      </Hero>

      <MetaRow>
        {metaParts.length > 0 && <Text type="secondary">{metaParts.join(' · ')}</Text>}
        {metacriticScore !== null && (
          <Tag color={metacriticColor(metacriticScore)} style={{ margin: 0 }}>
            Metacritic {metacriticScore}
          </Tag>
        )}
        {recommendationsTotal !== null && (
          <Text type="secondary">
            <TeamOutlined /> {formatCount(recommendationsTotal)} avaliações na Steam
          </Text>
        )}
      </MetaRow>

      <GenresRow>
        {genres.map((genre) => (
          <Tag key={genre}>{genre}</Tag>
        ))}
      </GenresRow>

      {shortDescription && <Text style={{ display: 'block', marginBottom: 16 }}>{shortDescription}</Text>}

      {trailerUrl && <Trailer src={trailerUrl} controls preload="metadata" poster={coverUrl} />}

      {screenshots.length > 0 && (
        <Image.PreviewGroup>
          <ScreenshotsRow>
            {screenshots.map((url) => (
              <Image key={url} src={url} height={90} style={{ borderRadius: 6 }} />
            ))}
          </ScreenshotsRow>
        </Image.PreviewGroup>
      )}
    </>
  )
}
