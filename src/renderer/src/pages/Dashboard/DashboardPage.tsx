import { Button, Empty, Row, Col, Spin, Typography, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { FilterBar } from '@renderer/components/FilterBar/FilterBar'
import { DealCard } from '@renderer/components/DealCard/DealCard'
import { useDeals, useFetchDeals } from '@renderer/hooks/useDeals'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import type { FilterSettings } from '@shared/types'

const { Title } = Typography

export function DashboardPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { data: deals = [], isLoading } = useDeals()
  const fetchDeals = useFetchDeals()

  if (!settings) return <Spin />

  const handleFilterChange = (partial: Partial<FilterSettings>): void => {
    updateSettings.mutate({ filters: { ...settings.filters, ...partial } })
  }

  const sortedDeals = [...deals].sort(
    (a, b) => (b.steamDiscountPercent ?? 0) - (a.steamDiscountPercent ?? 0)
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Ofertas para você
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
        <Row gutter={[16, 16]}>
          {sortedDeals.map((deal) => (
            <Col key={deal.appId ?? deal.title} xs={24} sm={12} md={8} lg={6}>
              <DealCard deal={deal} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
