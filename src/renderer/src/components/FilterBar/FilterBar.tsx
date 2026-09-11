import { Card, Slider, Space, Switch, Tooltip, Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import type { FilterSettings } from '@shared/types'

const { Text } = Typography

const FilterRow = styled(Space)`
  width: 100%;
  flex-wrap: wrap;
`

interface FilterBarProps {
  filters: FilterSettings
  onChange: (partial: Partial<FilterSettings>) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <FilterRow size="large" align="center">
        <Space direction="vertical" size={0}>
          <Text type="secondary">
            Desconto mínimo (Steam): {filters.minDiscountPercent}%{' '}
            <Tooltip title="Uma oferta também passa se o preço atual já bater o menor preço histórico do GG.deals, mesmo sem desconto ativo na Steam.">
              <InfoCircleOutlined />
            </Tooltip>
          </Text>
          <Slider
            style={{ width: 220 }}
            min={0}
            max={90}
            step={5}
            value={filters.minDiscountPercent}
            onChange={(value) => onChange({ minDiscountPercent: value })}
          />
        </Space>

        <Space direction="vertical" size={0} align="center">
          <Text type="secondary">Incluir keyshops</Text>
          <Switch
            checked={filters.includeKeyshops}
            onChange={(checked) => onChange({ includeKeyshops: checked })}
          />
        </Space>

        <Space direction="vertical" size={0} align="center">
          <Text type="secondary">Só wishlist</Text>
          <Switch
            checked={filters.wishlistOnlyMode}
            onChange={(checked) => onChange({ wishlistOnlyMode: checked })}
          />
        </Space>
      </FilterRow>
    </Card>
  )
}
