import { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { notification } from 'antd'
import { ThunderboltFilled } from '@ant-design/icons'
import styled from 'styled-components'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { DashboardPage } from '@renderer/pages/Dashboard/DashboardPage'
import { LibraryPage } from '@renderer/pages/Library/LibraryPage'
import { WishlistPage } from '@renderer/pages/Wishlist/WishlistPage'
import { GameDetailPage } from '@renderer/pages/GameDetail/GameDetailPage'
import { HistoryPage } from '@renderer/pages/History/HistoryPage'
import { LogSessaoPage } from '@renderer/pages/LogSessao/LogSessaoPage'
import { SettingsPage } from '@renderer/pages/Settings/SettingsPage'
import { useDealsFoundListener } from '@renderer/hooks/useDeals'
import { playAlertSound } from '@renderer/lib/playAlertSound'
import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice, getDisplayDiscountPercent } from '@shared/dealPricing'

const NotificationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const CoverThumb = styled.img`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 6px;
`

const FallbackIcon = styled.div`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`

const NotificationTitle = styled.div`
  font-weight: 600;
`

const NotificationDescription = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
`

export function App() {
  const [api, contextHolder] = notification.useNotification()

  const handleDealFound = useCallback(
    (deal: GameDeal) => {
      playAlertSound()
      const best = getBestCurrentPrice(deal)
      const displayDiscountPercent = getDisplayDiscountPercent(deal)
      const discountText = displayDiscountPercent > 0 ? ` (-${displayDiscountPercent}%)` : ''
      const priceText = best
        ? `${deal.currency} ${best.price.toFixed(2)} (${best.label})${discountText}`
        : 'Nova oferta encontrada'

      api.open({
        message: (
          <NotificationRow>
            {deal.coverUrl ? (
              <CoverThumb src={deal.coverUrl} alt="" />
            ) : (
              <FallbackIcon>
                <ThunderboltFilled />
              </FallbackIcon>
            )}
            <div>
              <NotificationTitle>{deal.title}</NotificationTitle>
              <NotificationDescription>{priceText}</NotificationDescription>
            </div>
          </NotificationRow>
        ),
        description: null,
        placement: 'bottomRight'
      })
    },
    [api]
  )

  useDealsFoundListener(handleDealFound)

  return (
    <>
      {contextHolder}
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="game/:appId" element={<GameDetailPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="log-sessao" element={<LogSessaoPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </>
  )
}
