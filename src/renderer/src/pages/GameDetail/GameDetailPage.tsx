import { useParams, useNavigate } from 'react-router-dom'
import { Button, Descriptions, Empty, Image, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useDeals, useWishlistDealsCache } from '@renderer/hooks/useDeals'
import { GameCover } from '@renderer/components/GameCover/GameCover'
import { formatCount, formatPrice } from '@renderer/lib/formatters'
import { getBestCurrentPrice, getBestHistoricalLow } from '@shared/dealPricing'

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

const ScreenshotsRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 20px;
  padding-bottom: 4px;
`

const HighlightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`

const HighlightCard = styled.div`
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 14px 16px;
`

const HighlightLabel = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
    margin-bottom: 4px;
  }
`

const HighlightValue = styled.div`
  font-size: 20px;
  font-weight: 600;
`

function metacriticColor(score: number): string {
  if (score >= 75) return '#3fb950'
  if (score >= 50) return '#d4a72c'
  return '#f85149'
}

export function GameDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const { data: deals = [] } = useDeals()
  const { data: wishlistDeals = [] } = useWishlistDealsCache()
  const deal =
    deals.find((d) => String(d.appId) === appId) ?? wishlistDeals.find((d) => String(d.appId) === appId)

  if (!deal) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          Voltar
        </Button>
        <Empty description="Ainda não buscamos preço pra esse jogo nesta sessão.">
          {appId && (
            <a href={`https://store.steampowered.com/app/${appId}/`} target="_blank" rel="noreferrer">
              Ver na Steam
            </a>
          )}
        </Empty>
      </div>
    )
  }

  const bestCurrent = getBestCurrentPrice(deal)
  const historicalLow = getBestHistoricalLow(deal)

  // `deal` pode ter sido cacheado em disco por uma versão anterior do app, sem estes campos.
  const developers = deal.developers ?? []
  const publishers = deal.publishers ?? []
  const screenshots = deal.screenshots ?? []

  const metaParts: string[] = []
  if (developers.length > 0) metaParts.push(developers.join(', '))
  if (publishers.length > 0 && publishers.join(',') !== developers.join(','))
    metaParts.push(publishers.join(', '))
  if (deal.releaseDate) metaParts.push(deal.releaseDate)

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        Voltar
      </Button>

      <Hero>
        <GameCover url={deal.coverUrl} height={260} radius={10} />
        <HeroScrim />
        <HeroTitle level={2}>{deal.title}</HeroTitle>
      </Hero>

      <MetaRow>
        {metaParts.length > 0 && <Text type="secondary">{metaParts.join(' · ')}</Text>}
        {deal.metacriticScore !== null && (
          <Tag color={metacriticColor(deal.metacriticScore)} style={{ margin: 0 }}>
            Metacritic {deal.metacriticScore}
          </Tag>
        )}
        {deal.recommendationsTotal !== null && (
          <Text type="secondary">
            <TeamOutlined /> {formatCount(deal.recommendationsTotal)} avaliações na Steam
          </Text>
        )}
      </MetaRow>

      <GenresRow>
        {deal.genres.map((genre) => (
          <Tag key={genre}>{genre}</Tag>
        ))}
      </GenresRow>

      {deal.shortDescription && (
        <Text style={{ display: 'block', marginBottom: 16 }}>{deal.shortDescription}</Text>
      )}

      {screenshots.length > 0 && (
        <Image.PreviewGroup>
          <ScreenshotsRow>
            {screenshots.map((url) => (
              <Image
                key={url}
                src={url}
                height={90}
                style={{ borderRadius: 6 }}
                rootClassName="screenshot-thumb"
              />
            ))}
          </ScreenshotsRow>
        </Image.PreviewGroup>
      )}

      <HighlightGrid>
        <HighlightCard>
          <HighlightLabel>Preço na Steam</HighlightLabel>
          <HighlightValue>
            {formatPrice(deal.currency, deal.steamPrice)}
            {deal.steamDiscountPercent ? (
              <Tag color="green" style={{ marginLeft: 8 }}>
                -{deal.steamDiscountPercent}%
              </Tag>
            ) : null}
          </HighlightValue>
        </HighlightCard>

        <HighlightCard>
          <HighlightLabel>Melhor preço agora {bestCurrent ? `(${bestCurrent.label})` : ''}</HighlightLabel>
          <HighlightValue>{formatPrice(deal.currency, bestCurrent?.price ?? null)}</HighlightValue>
        </HighlightCard>

        <HighlightCard>
          <HighlightLabel>
            <TrophyOutlined /> Menor preço histórico
          </HighlightLabel>
          <HighlightValue>{formatPrice(deal.currency, historicalLow)}</HighlightValue>
        </HighlightCard>
      </HighlightGrid>

      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label="Menor preço atual (lojas oficiais)">
          {formatPrice(deal.currency, deal.currentRetailPrice)}
        </Descriptions.Item>
        <Descriptions.Item label="Menor preço atual (keyshops)">
          {formatPrice(deal.currency, deal.currentKeyshopPrice)}
        </Descriptions.Item>
        <Descriptions.Item label="Menor histórico (lojas oficiais)">
          {formatPrice(deal.currency, deal.historicalRetailLow)}
        </Descriptions.Item>
        <Descriptions.Item label="Menor histórico (keyshops)">
          {formatPrice(deal.currency, deal.historicalKeyshopLow)}
        </Descriptions.Item>
      </Descriptions>

      {deal.ggDealsUrl && (
        <a
          href={deal.ggDealsUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', marginTop: 16 }}
        >
          Ver todas as lojas no GG.deals
        </a>
      )}
    </div>
  )
}
