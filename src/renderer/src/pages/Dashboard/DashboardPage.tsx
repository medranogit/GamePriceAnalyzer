import { useEffect, useState } from 'react'
import { Empty, Row, Col, Space, Spin, Tag, Typography, Pagination } from 'antd'
import { FilterBar } from '@renderer/components/FilterBar/FilterBar'
import { DealCard } from '@renderer/components/DealCard/DealCard'
import { RefreshCountdown } from '@renderer/components/RefreshCountdown/RefreshCountdown'
import { useDeals } from '@renderer/hooks/useDeals'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import { matchesSearchTokens } from '@renderer/lib/matchesSearchTokens'
import { getBestCurrentPrice, getDisplayDiscountPercent, isAtOrBelowHistoricalLow } from '@shared/dealPricing'
import type { FilterSettings } from '@shared/types'

const { Title } = Typography

const PAGE_SIZE = 24

export function DashboardPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { data: deals = [], isLoading, dataUpdatedAt } = useDeals()

  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  const filters = settings?.filters

  const genreCounts = new Map<string, number>()
  for (const deal of deals) {
    for (const genre of deal.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
  }
  const availableGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre)

  const filteredDeals = filters
    ? deals
        .filter((deal) => matchesSearchTokens(deal.title, searchTerm))
        .filter((deal) => getDisplayDiscountPercent(deal) >= filters.minDiscountPercent)
        .map((deal) =>
          filters.includeKeyshops ? deal : { ...deal, currentKeyshopPrice: null, historicalKeyshopLow: null }
        )
        .filter((deal) => {
          const best = getBestCurrentPrice(deal)
          if (!best) return filters.minPrice === null && filters.maxPrice === null
          if (filters.minPrice !== null && best.price < filters.minPrice) return false
          if (filters.maxPrice !== null && best.price > filters.maxPrice) return false
          return true
        })
        .filter(
          (deal) =>
            filters.selectedGenres.length === 0 ||
            deal.genres.some((genre) => filters.selectedGenres.includes(genre))
        )
        .filter((deal) => !filters.onlyHistoricalLow || isAtOrBelowHistoricalLow(deal))
    : []

  // Quem teve o preço reconferido mais recentemente (priceUpdatedAt) aparece primeiro — cobre tanto
  // oferta nova (primeira vez que o preço é buscado) quanto oferta antiga que acabou de ser atualizada.
  // Cache salvo antes desse campo existir cai pro firstSeenAt como aproximação.
  const sortedDeals = [...filteredDeals].sort((a, b) =>
    (b.priceUpdatedAt ?? b.firstSeenAt ?? '').localeCompare(a.priceUpdatedAt ?? a.firstSeenAt ?? '')
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [
    deals,
    searchTerm,
    filters?.minDiscountPercent,
    filters?.includeKeyshops,
    filters?.selectedGenres,
    filters?.minPrice,
    filters?.maxPrice,
    filters?.onlyHistoricalLow
  ])

  const pagedDeals = sortedDeals.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (!settings) return <Spin />

  const handleFilterChange = (partial: Partial<FilterSettings>): void => {
    updateSettings.mutate({ filters: { ...settings.filters, ...partial } })
  }

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
      >
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Ofertas para você
          {sortedDeals.length > 0 && <Tag color="blue">{sortedDeals.length} promoções</Tag>}
        </Title>
        <Space size="middle">
          <RefreshCountdown dataUpdatedAt={dataUpdatedAt} />
        </Space>
      </div>

      <FilterBar
        filters={settings.filters}
        onChange={handleFilterChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        availableGenres={availableGenres}
      />

      {isLoading ? (
        <Spin />
      ) : sortedDeals.length === 0 ? (
        <Empty description="Nenhuma oferta encontrada ainda. A busca roda sozinha em segundo plano." />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {pagedDeals.map((deal) => (
              <Col key={deal.appId ?? deal.title} xs={24} sm={12} md={8} lg={6}>
                <DealCard deal={deal} />
              </Col>
            ))}
          </Row>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              total={sortedDeals.length}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  )
}
