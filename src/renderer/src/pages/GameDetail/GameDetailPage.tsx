import { useParams, useNavigate } from 'react-router-dom'
import { Button, Descriptions, Empty, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, TrophyOutlined } from '@ant-design/icons'
import { useDeals, useWishlistDealsCache } from '@renderer/hooks/useDeals'
import { GameCover } from '@renderer/components/GameCover/GameCover'
import { formatPrice } from '@renderer/lib/formatters'

const { Title, Text } = Typography

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

  const historicalLow = [deal.historicalRetailLow, deal.historicalKeyshopLow]
    .filter((v): v is number => v !== null)
    .reduce((min, v) => (min === null || v < min ? v : min), null as number | null)

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        Voltar
      </Button>

      <GameCover url={deal.coverUrl} height={220} radius={10} style={{ marginBottom: 16 }} />

      <Title level={2}>{deal.title}</Title>
      <div style={{ marginBottom: 16 }}>
        {deal.genres.map((genre) => (
          <Tag key={genre}>{genre}</Tag>
        ))}
      </div>

      {deal.shortDescription && (
        <Text style={{ display: 'block', marginBottom: 16 }}>{deal.shortDescription}</Text>
      )}

      {historicalLow !== null && (
        <Text style={{ display: 'block', marginBottom: 16 }}>
          <TrophyOutlined /> Menor preço histórico: {formatPrice(deal.currency, historicalLow)}
        </Text>
      )}

      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label="Preço na Steam">
          {formatPrice(deal.currency, deal.steamPrice)}
          {deal.steamDiscountPercent ? (
            <Tag color="green" style={{ marginLeft: 8 }}>
              -{deal.steamDiscountPercent}%
            </Tag>
          ) : null}
        </Descriptions.Item>
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
