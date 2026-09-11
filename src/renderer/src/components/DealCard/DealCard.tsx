import { Tag } from 'antd'
import { ShopOutlined, KeyOutlined, TrophyOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice, getBestHistoricalLow, getDisplayDiscountPercent } from '@shared/dealPricing'
import { GameCover } from '@renderer/components/GameCover/GameCover'

const CardWrapper = styled.div`
  position: relative;
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

const DiscountRibbon = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  background: ${({ theme }) => theme.colors.success};
  color: #06210f;
  font-weight: 700;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
`

const HistoricalRibbon = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: ${({ theme }) => theme.colors.warning};
  color: #2b2100;
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
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

const PriceBlock = styled.div`
  margin-top: auto;
  display: flex;
  align-items: baseline;
  gap: 8px;
`

const Price = styled.span`
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.success};
`

const StoreLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`

interface DealCardProps {
  deal: GameDeal
}

export function DealCard({ deal }: DealCardProps) {
  const navigate = useNavigate()
  const best = getBestCurrentPrice(deal)
  const historicalLow = getBestHistoricalLow(deal)
  const isHistoricalLow = best !== null && historicalLow !== null && best.price <= historicalLow
  const displayDiscountPercent = getDisplayDiscountPercent(deal)

  return (
    <CardWrapper onClick={() => deal.appId && navigate(`/game/${deal.appId}`)}>
      <GameCover url={deal.coverUrl} height={140}>
        {isHistoricalLow && (
          <HistoricalRibbon>
            <TrophyOutlined /> Menor histórico
          </HistoricalRibbon>
        )}
        {displayDiscountPercent > 0 && <DiscountRibbon>-{displayDiscountPercent}%</DiscountRibbon>}
      </GameCover>

      <Body>
        <GameTitle title={deal.title}>{deal.title}</GameTitle>

        <GenreRow>
          {deal.genres.slice(0, 2).map((genre) => (
            <Tag key={genre} style={{ margin: 0 }}>
              {genre}
            </Tag>
          ))}
        </GenreRow>

        <PriceBlock>
          {best ? (
            <>
              <Price>
                {deal.currency} {best.price.toFixed(2)}
              </Price>
              <StoreLabel>
                {best.label === 'Keyshop' ? <KeyOutlined /> : <ShopOutlined />}
                {best.label}
              </StoreLabel>
            </>
          ) : (
            <StoreLabel>Sem preço disponível</StoreLabel>
          )}
        </PriceBlock>
      </Body>
    </CardWrapper>
  )
}
