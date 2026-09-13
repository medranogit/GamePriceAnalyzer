import { Image, Tag, Typography } from 'antd'
import { CalendarOutlined, CodeOutlined, ShopOutlined, StarOutlined, TeamOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { GameCover } from '@renderer/components/GameCover/GameCover'
import { HlsVideo } from '@renderer/components/HlsVideo/HlsVideo'
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

const CreditsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
`

const CreditLine = styled(Text)`
  &&& {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 13px;
  }
`

const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
`

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 8px 14px;
`

const StatIconBadge = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 14px;
  color: ${({ $accent }) => $accent};
  background: ${({ $accent }) => $accent}26;
`

const StatLabel = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 11px;
    line-height: 1.3;
  }
`

const StatValue = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
`

const GenresRow = styled.div`
  margin-bottom: 16px;
`

const Trailer = styled(HlsVideo)`
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

const RELEASE_DATE_ACCENT = '#1fa89e'
const REVIEWS_ACCENT = '#9254de'

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
  const showPublishers = publishers.length > 0 && publishers.join(',') !== developers.join(',')
  const galleryImages = coverUrl ? [coverUrl, ...screenshots.filter((url) => url !== coverUrl)] : screenshots

  return (
    <>
      <Hero>
        <GameCover url={coverUrl} height={260} radius={10} />
        <HeroScrim />
        <HeroTitle level={2}>{title}</HeroTitle>
      </Hero>

      {(developers.length > 0 || showPublishers) && (
        <CreditsColumn>
          {developers.length > 0 && (
            <CreditLine>
              <CodeOutlined /> Desenvolvido por {developers.join(', ')}
            </CreditLine>
          )}
          {showPublishers && (
            <CreditLine>
              <ShopOutlined /> Publicado por {publishers.join(', ')}
            </CreditLine>
          )}
        </CreditsColumn>
      )}

      <StatsRow>
        {releaseDate && (
          <StatCard>
            <StatIconBadge $accent={RELEASE_DATE_ACCENT}>
              <CalendarOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Lançamento</StatLabel>
              <StatValue>{releaseDate}</StatValue>
            </div>
          </StatCard>
        )}

        {metacriticScore !== null && (
          <StatCard>
            <StatIconBadge $accent={metacriticColor(metacriticScore)}>
              <StarOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Metacritic</StatLabel>
              <StatValue>{metacriticScore}</StatValue>
            </div>
          </StatCard>
        )}

        {recommendationsTotal !== null && (
          <StatCard>
            <StatIconBadge $accent={REVIEWS_ACCENT}>
              <TeamOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Avaliações na Steam</StatLabel>
              <StatValue>{formatCount(recommendationsTotal)}</StatValue>
            </div>
          </StatCard>
        )}
      </StatsRow>

      <GenresRow>
        {genres.map((genre) => (
          <Tag key={genre}>{genre}</Tag>
        ))}
      </GenresRow>

      {shortDescription && <Text style={{ display: 'block', marginBottom: 16 }}>{shortDescription}</Text>}

      {trailerUrl && <Trailer src={trailerUrl} poster={coverUrl} />}

      {galleryImages.length > 0 && (
        <Image.PreviewGroup>
          <ScreenshotsRow>
            {galleryImages.map((url) => (
              <Image key={url} src={url} height={90} style={{ borderRadius: 6 }} />
            ))}
          </ScreenshotsRow>
        </Image.PreviewGroup>
      )}
    </>
  )
}
