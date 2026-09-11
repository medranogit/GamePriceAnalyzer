import { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { notification } from 'antd'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { DashboardPage } from '@renderer/pages/Dashboard/DashboardPage'
import { LibraryPage } from '@renderer/pages/Library/LibraryPage'
import { WishlistPage } from '@renderer/pages/Wishlist/WishlistPage'
import { GenresPage } from '@renderer/pages/Genres/GenresPage'
import { GameDetailPage } from '@renderer/pages/GameDetail/GameDetailPage'
import { SettingsPage } from '@renderer/pages/Settings/SettingsPage'
import { useDealsFoundListener } from '@renderer/hooks/useDeals'
import { playAlertSound } from '@renderer/lib/playAlertSound'
import type { GameDeal } from '@shared/types'
import { getBestCurrentPrice } from '@shared/dealPricing'

export function App() {
  const [api, contextHolder] = notification.useNotification()

  const handleDealFound = useCallback(
    (deal: GameDeal) => {
      playAlertSound()
      const best = getBestCurrentPrice(deal)
      const discountText = deal.steamDiscountPercent ? ` (-${deal.steamDiscountPercent}%)` : ''
      api.open({
        message: deal.title,
        description: best
          ? `${deal.currency} ${best.price.toFixed(2)} (${best.label})${discountText}`
          : 'Nova oferta encontrada',
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
          <Route path="genres" element={<GenresPage />} />
          <Route path="game/:appId" element={<GameDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </>
  )
}
