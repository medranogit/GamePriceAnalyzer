import { useParams, useNavigate } from 'react-router-dom'
import { Button, Empty, Progress, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ClockCircleOutlined, ExportOutlined, TrophyOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useLibrary } from '@renderer/hooks/useLibrary'
import { useMetadataCache, useGameAchievements } from '@renderer/hooks/useMetadata'
import { GameHero } from '@renderer/components/GameHero/GameHero'
import { formatDate } from '@renderer/lib/formatters'

const { Text } = Typography

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 14px 16px;
`

const StatIconBadge = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 18px;
  color: ${({ $accent }) => $accent};
  background: ${({ $accent }) => $accent}26;
`

const StatLabel = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
  }
`

const StatValue = styled.div`
  font-size: 18px;
  font-weight: 600;
`

const SectionTitle = styled.h3`
  margin: 0 0 12px;
`

const ContentColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
`

const AchievementsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 10px;
`

const AchievementIcon = styled.img<{ $achieved: boolean }>`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  opacity: ${({ $achieved }) => ($achieved ? 1 : 0.4)};
  filter: ${({ $achieved }) => ($achieved ? 'none' : 'grayscale(60%)')};
  border: 1px solid ${({ theme }) => theme.colors.border};
`

const AchievementsMoreTile = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceRaised};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`

const MAX_VISIBLE_ACHIEVEMENTS = 30

const PLAYTIME_ACCENT = '#1fa89e'
const ACHIEVEMENTS_ACCENT = '#d4a72c'

export function LibraryGameDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const numericAppId = appId ? Number(appId) : null

  const { data: games = [] } = useLibrary()
  const { data: metadataList = [] } = useMetadataCache()
  const { data: achievements } = useGameAchievements(numericAppId)

  const game = games.find((g) => String(g.appId) === appId)
  const metadata = metadataList.find((m) => String(m.appId) === appId)

  if (!game) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          Voltar
        </Button>
        <Empty description="Jogo não encontrado na sua biblioteca sincronizada." />
      </div>
    )
  }

  const steamStoreUrl = `https://store.steampowered.com/app/${game.appId}/`
  const hours = game.playtimeForeverMinutes / 60

  const sortedAchievements = achievements
    ? [...achievements.achievements].sort((a, b) => Number(b.achieved) - Number(a.achieved))
    : []
  const visibleAchievements = sortedAchievements.slice(0, MAX_VISIBLE_ACHIEVEMENTS)
  const hiddenAchievementsCount = sortedAchievements.length - visibleAchievements.length

  return (
    <div>
      <TopBar>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <a href={steamStoreUrl} target="_blank" rel="noreferrer">
          <Button icon={<ExportOutlined />}>Ver na Steam</Button>
        </a>
      </TopBar>

      <GameHero
        title={game.name}
        coverUrl={metadata?.headerImageUrl ?? game.iconUrl}
        genres={metadata?.genres ?? []}
        developers={metadata?.developers ?? []}
        publishers={metadata?.publishers ?? []}
        releaseDate={metadata?.releaseDate ?? null}
        metacriticScore={metadata?.metacriticScore ?? null}
        recommendationsTotal={metadata?.recommendationsTotal ?? null}
        shortDescription={metadata?.shortDescription ?? null}
        trailerUrl={metadata?.trailerUrl ?? null}
        screenshots={metadata?.screenshots ?? []}
      />

      <StatsGrid>
        <StatCard>
          <StatIconBadge $accent={PLAYTIME_ACCENT}>
            <ClockCircleOutlined />
          </StatIconBadge>
          <div>
            <StatLabel>Tempo jogado</StatLabel>
            <StatValue>{hours > 0 ? `${hours.toFixed(1)}h` : 'Nunca jogado'}</StatValue>
          </div>
        </StatCard>

        {achievements && (
          <StatCard>
            <StatIconBadge $accent={ACHIEVEMENTS_ACCENT}>
              <TrophyOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Conquistas</StatLabel>
              <StatValue>
                {achievements.unlocked}/{achievements.total}
              </StatValue>
            </div>
          </StatCard>
        )}
      </StatsGrid>

      <ContentColumns>
        <div>
          {achievements && achievements.total > 0 && (
            <>
              <SectionTitle>Conquistas</SectionTitle>
              <Progress
                percent={Math.round((achievements.unlocked / achievements.total) * 100)}
                style={{ marginBottom: 12 }}
              />
              <AchievementsGrid>
                {visibleAchievements.map((achievement) => (
                  <Tooltip
                    key={achievement.apiName}
                    title={
                      <>
                        <strong>{achievement.displayName}</strong>
                        {achievement.description && <div>{achievement.description}</div>}
                        {achievement.achieved && achievement.unlockedAt && (
                          <div>Desbloqueada em {formatDate(achievement.unlockedAt)}</div>
                        )}
                      </>
                    }
                  >
                    <AchievementIcon
                      src={achievement.achieved ? achievement.iconUrl : achievement.iconGrayUrl}
                      $achieved={achievement.achieved}
                      alt={achievement.displayName}
                    />
                  </Tooltip>
                ))}
                {hiddenAchievementsCount > 0 && (
                  <Tooltip title={`+${hiddenAchievementsCount} conquista(s) não exibida(s)`}>
                    <AchievementsMoreTile>+{hiddenAchievementsCount}</AchievementsMoreTile>
                  </Tooltip>
                )}
              </AchievementsGrid>
            </>
          )}
        </div>
        <div />
      </ContentColumns>
    </div>
  )
}
