import { useEffect, useState } from 'react'
import { Button, Empty, Row, Col, Spin, Tag, Typography, Pagination, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { FilterBar } from '@renderer/components/FilterBar/FilterBar'
import { DealCard } from '@renderer/components/DealCard/DealCard'
import { useDeals, useFetchDeals } from '@renderer/hooks/useDeals'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import type { FilterSettings } from '@shared/types'

const { Title } = Typography

const PAGE_SIZE = 24

export function DashboardPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { data: deals = [], isLoading } = useDeals()
  const fetchDeals = useFetchDeals()

  const [currentPage, setCurrentPage] = useState(1)

  const sortedDeals = [...deals].sort((a, b) => (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? ''))

  useEffect(() => {
    setCurrentPage(1)
  }, [deals])

  const pagedDeals = sortedDeals.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (!settings) return <Spin />

  const handleFilterChange = (partial: Partial<FilterSettings>): void => {
    updateSettings.mutate({ filters: { ...settings.filters, ...partial } })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Ofertas para você
          {sortedDeals.length > 0 && <Tag color="blue">{sortedDeals.length} promoções</Tag>}
        </Title>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={fetchDeals.isPending}
          onClick={() =>
            fetchDeals.mutate(undefined, {
              onError: (error) => message.error(error instanceof Error ? error.message : 'Falha ao buscar ofertas.')
            })
          }
        >
          Buscar ofertas agora
        </Button>
      </div>

      <FilterBar filters={settings.filters} onChange={handleFilterChange} />

      {isLoading ? (
        <Spin />
      ) : sortedDeals.length === 0 ? (
        <Empty description="Nenhuma oferta ainda. Clique em 'Buscar ofertas agora'." />
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
