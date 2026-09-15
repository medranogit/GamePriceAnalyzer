import { Card, Input, InputNumber, Select, Slider, Space, Switch, Tooltip, Typography } from 'antd'
import { InfoCircleOutlined, SearchOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import type { FilterSettings } from '@shared/types'
import { getGenreIcon } from '@renderer/lib/genreIcons'

const { Text } = Typography

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
`

const FiltersGroup = styled(Space)`
  flex-wrap: wrap;
`

interface FilterBarProps {
  filters: FilterSettings
  onChange: (partial: Partial<FilterSettings>) => void
  searchTerm: string
  onSearchChange: (value: string) => void
  availableGenres: string[]
}

export function FilterBar({
  filters,
  onChange,
  searchTerm,
  onSearchChange,
  availableGenres
}: FilterBarProps) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <TopRow>
        <Input
          style={{ width: 280 }}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Filtrar por nome..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <FiltersGroup size="large" align="center">
          <Space direction="vertical" size={0}>
            <Text type="secondary">
              Desconto mínimo: {filters.minDiscountPercent}%{' '}
              <Tooltip title="Compara o melhor preço atual (loja oficial ou keyshop) contra o preço cheio da Steam — já que o GG.deals não informa desconto % por loja. Deixe em 0% pra ver tudo que está na wishlist, sem filtrar por desconto.">
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

          <Space direction="vertical" size={0}>
            <Text type="secondary">Faixa de preço</Text>
            <Space.Compact>
              <InputNumber
                style={{ width: 100 }}
                min={0}
                placeholder="De"
                value={filters.minPrice}
                onChange={(value) => onChange({ minPrice: value })}
              />
              <InputNumber
                style={{ width: 100 }}
                min={0}
                placeholder="Até"
                value={filters.maxPrice}
                onChange={(value) => onChange({ maxPrice: value })}
              />
            </Space.Compact>
          </Space>

          <Space direction="vertical" size={0}>
            <Text type="secondary">Gêneros</Text>
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 200, maxWidth: 320 }}
              placeholder="Todos os gêneros"
              value={filters.selectedGenres}
              onChange={(value) => onChange({ selectedGenres: value })}
              options={availableGenres.map((genre) => ({
                value: genre,
                label: (
                  <Space size={6}>
                    {getGenreIcon(genre)}
                    {genre}
                  </Space>
                )
              }))}
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
            <Text type="secondary">
              Só menor preço histórico{' '}
              <Tooltip title="Mostra só ofertas em que o preço atual (loja oficial ou keyshop) já é igual ou menor que o menor preço já visto pra esse jogo no GG.deals.">
                <InfoCircleOutlined />
              </Tooltip>
            </Text>
            <Switch
              checked={filters.onlyHistoricalLow}
              onChange={(checked) => onChange({ onlyHistoricalLow: checked })}
            />
          </Space>
        </FiltersGroup>
      </TopRow>
    </Card>
  )
}
