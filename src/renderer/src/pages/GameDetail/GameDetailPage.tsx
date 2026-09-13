import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Empty, message, Space, Tag, Tooltip, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  ShopOutlined,
  SyncOutlined,
  TrophyOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { useDeals, useWishlistDealsCache } from '@renderer/hooks/useDeals'
import { useResolveGameMetadata, useResolveOneProgress } from '@renderer/hooks/useMetadata'
import { GameHero } from '@renderer/components/GameHero/GameHero'
import { formatPrice } from '@renderer/lib/formatters'
import { getBestCurrentPrice, getBestHistoricalLow } from '@shared/dealPricing'

const { Text } = Typography

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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

const StoreGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`

const StoreCard = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left: 3px solid ${({ $accent }) => $accent};
  border-radius: 10px;
  padding: 14px 16px;
`

const StoreIconBadge = styled.div<{ $accent: string }>`
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

const StoreLabel = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
  }
`

const StoreValue = styled.div`
  font-size: 18px;
  font-weight: 600;
`

const RETAIL_ACCENT = '#1fa89e'
const KEYSHOP_ACCENT = '#9254de'
const HISTORICAL_ACCENT = '#d4a72c'

export function GameDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const { data: deals = [] } = useDeals()
  const { data: wishlistDeals = [] } = useWishlistDealsCache()
  const deal =
    deals.find((d) => String(d.appId) === appId) ?? wishlistDeals.find((d) => String(d.appId) === appId)
  const resolveMetadata = useResolveGameMetadata()
  const { data: resolveProgress } = useResolveOneProgress(deal?.appId ?? -1, resolveMetadata.isPending)
  const [mediaRefreshToken, setMediaRefreshToken] = useState(0)
  const [openingMediaFolder, setOpeningMediaFolder] = useState(false)
  const autoResolveTriggeredRef = useRef(false)

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

  const steamStoreUrl = deal.appId !== null ? `https://store.steampowered.com/app/${deal.appId}/` : null

  const bestCurrent = getBestCurrentPrice(deal)
  const historicalLow = getBestHistoricalLow(deal)

  const handleResolveMetadata = (): void => {
    if (deal.appId === null) return
    resolveMetadata.mutate(deal.appId, {
      onSuccess: (result) => {
        if (result) {
          message.success(`Metadata atualizada para "${result.title}".`)
          setMediaRefreshToken((token) => token + 1)
        } else {
          message.warning(`Não consegui metadata da Steam para "${deal.title}".`)
        }
      },
      onError: (error) => {
        message.error(error instanceof Error ? error.message : 'Falha ao buscar metadata.')
      }
    })
  }

  const handleOpenMediaFolder = async (): Promise<void> => {
    if (deal.appId === null) return
    setOpeningMediaFolder(true)
    try {
      await window.api.localMedia.openGameFolder(deal.appId)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Falha ao abrir a pasta.')
    } finally {
      setOpeningMediaFolder(false)
    }
  }

  const handleLocalMediaMissing = (): void => {
    if (deal.appId === null || autoResolveTriggeredRef.current || resolveMetadata.isPending) return
    autoResolveTriggeredRef.current = true
    message.info(`Mídia local de "${deal.title}" não encontrada — buscando de novo...`)
    resolveMetadata.mutate(deal.appId, {
      onSuccess: (result) => {
        if (result) {
          message.success(`Metadata atualizada para "${result.title}".`)
          setMediaRefreshToken((token) => token + 1)
        }
      },
      onError: (error) => {
        message.error(error instanceof Error ? error.message : 'Falha ao buscar metadata.')
      }
    })
  }

  return (
    <div>
      <TopBar>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <Space>
          {resolveMetadata.isPending && resolveProgress && resolveProgress.total > 0 && (
            <Text type="success" strong>
              {Math.round((resolveProgress.completed / resolveProgress.total) * 100)}%
            </Text>
          )}
          {deal.appId !== null && (
            <Tooltip title="Busca a metadata da Steam (capa, gênero, sinopse, trailer...) só deste jogo">
              <Button
                icon={<SyncOutlined />}
                loading={resolveMetadata.isPending}
                onClick={handleResolveMetadata}
              >
                Buscar metadados da Steam
              </Button>
            </Tooltip>
          )}
          {deal.appId !== null && (
            <Tooltip title="Abre a pasta onde a mídia local desse jogo (capa, screenshots, trailers baixados) fica salva">
              <Button
                icon={<FolderOpenOutlined />}
                loading={openingMediaFolder}
                onClick={handleOpenMediaFolder}
              >
                Abrir pasta de mídia
              </Button>
            </Tooltip>
          )}
          {steamStoreUrl && (
            <a href={steamStoreUrl} target="_blank" rel="noreferrer">
              <Button icon={<ExportOutlined />}>Ver na Steam</Button>
            </a>
          )}
        </Space>
      </TopBar>

      <GameHero
        title={deal.title}
        coverUrl={deal.coverUrl}
        genres={deal.genres}
        developers={deal.developers ?? []}
        publishers={deal.publishers ?? []}
        releaseDate={deal.releaseDate}
        metacriticScore={deal.metacriticScore}
        recommendationsTotal={deal.recommendationsTotal}
        shortDescription={deal.shortDescription}
        trailers={deal.trailers ?? []}
        screenshots={deal.screenshots ?? []}
        mediaRefreshToken={mediaRefreshToken}
        onLocalMediaMissing={handleLocalMediaMissing}
      />

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

      <StoreGrid>
        <StoreCard $accent={RETAIL_ACCENT}>
          <StoreIconBadge $accent={RETAIL_ACCENT}>
            <ShopOutlined />
          </StoreIconBadge>
          <div>
            <StoreLabel>Loja oficial · preço atual</StoreLabel>
            <StoreValue>{formatPrice(deal.currency, deal.currentRetailPrice)}</StoreValue>
          </div>
        </StoreCard>

        <StoreCard $accent={KEYSHOP_ACCENT}>
          <StoreIconBadge $accent={KEYSHOP_ACCENT}>
            <KeyOutlined />
          </StoreIconBadge>
          <div>
            <StoreLabel>Keyshop · preço atual</StoreLabel>
            <StoreValue>{formatPrice(deal.currency, deal.currentKeyshopPrice)}</StoreValue>
          </div>
        </StoreCard>

        <StoreCard $accent={HISTORICAL_ACCENT}>
          <StoreIconBadge $accent={HISTORICAL_ACCENT}>
            <TrophyOutlined />
          </StoreIconBadge>
          <div>
            <StoreLabel>Loja oficial · menor histórico</StoreLabel>
            <StoreValue>{formatPrice(deal.currency, deal.historicalRetailLow)}</StoreValue>
          </div>
        </StoreCard>

        <StoreCard $accent={HISTORICAL_ACCENT}>
          <StoreIconBadge $accent={HISTORICAL_ACCENT}>
            <TrophyOutlined />
          </StoreIconBadge>
          <div>
            <StoreLabel>Keyshop · menor histórico</StoreLabel>
            <StoreValue>{formatPrice(deal.currency, deal.historicalKeyshopLow)}</StoreValue>
          </div>
        </StoreCard>
      </StoreGrid>

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
