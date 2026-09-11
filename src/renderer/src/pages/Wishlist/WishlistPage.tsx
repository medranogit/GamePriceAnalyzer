import { useMemo, useState } from 'react'
import { AutoComplete, Avatar, Button, Input, Popconfirm, Space, Table, Tag, Tooltip, Typography, message } from 'antd'
import { CloudSyncOutlined, ReloadOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  useAddWishlistItem,
  useRemoveWishlistItem,
  useSyncSteamWishlist,
  useWishlist,
  useWishlistPrices
} from '@renderer/hooks/useWishlist'
import { useSettings } from '@renderer/hooks/useSettings'
import { useSteamSearch } from '@renderer/hooks/useSteamSearch'
import { useDebouncedValue } from '@renderer/hooks/useDebouncedValue'
import { matchesSearchTokens } from '@renderer/lib/matchesSearchTokens'
import { formatPrice, formatDate } from '@renderer/lib/formatters'
import type { WishlistItem, WishlistPriceInfo } from '@shared/types'

const { Title, Text } = Typography

function steamCapsuleUrl(appId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`
}

interface Row {
  item: WishlistItem
  price?: WishlistPriceInfo
}

export function WishlistPage() {
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const { data: wishlist = [], isLoading } = useWishlist()
  const addItem = useAddWishlistItem()
  const removeItem = useRemoveWishlistItem()
  const syncFromSteam = useSyncSteamWishlist()
  const refreshPrices = useWishlistPrices()

  const [addSearchTerm, setAddSearchTerm] = useState('')
  const debouncedAddSearchTerm = useDebouncedValue(addSearchTerm, 300)
  const { data: searchResults = [], isFetching: isSearching } = useSteamSearch(debouncedAddSearchTerm)

  const [filterTerm, setFilterTerm] = useState('')

  const priceByAppId = useMemo(() => {
    const map = new Map<number, WishlistPriceInfo>()
    for (const price of refreshPrices.data ?? []) map.set(price.appId, price)
    return map
  }, [refreshPrices.data])

  const rows: Row[] = wishlist
    .filter((item) => matchesSearchTokens(item.title, filterTerm))
    .map((item) => ({ item, price: priceByAppId.get(item.appId) }))

  const columns = [
    {
      title: '',
      key: 'cover',
      width: 72,
      render: (_: unknown, row: Row) => (
        <Avatar shape="square" size={48} src={row.price?.coverUrl ?? steamCapsuleUrl(row.item.appId)} />
      )
    },
    {
      title: 'Jogo',
      key: 'title',
      render: (_: unknown, row: Row) => row.item.title
    },
    {
      title: 'Preço atual (loja oficial)',
      key: 'currentRetail',
      render: (_: unknown, row: Row) => formatPrice(row.price?.currency ?? null, row.price?.currentRetailPrice ?? null)
    },
    {
      title: 'Preço atual (keyshop)',
      key: 'currentKeyshop',
      render: (_: unknown, row: Row) => formatPrice(row.price?.currency ?? null, row.price?.currentKeyshopPrice ?? null)
    },
    {
      title: 'Menor já visto (loja oficial)',
      key: 'lowestRetail',
      render: (_: unknown, row: Row) =>
        row.price?.localLowestRetail ? (
          <Space direction="vertical" size={0}>
            <Text strong>{formatPrice(row.price.currency, row.price.localLowestRetail)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              em {formatDate(row.price.localLowestRetailAt)}
            </Text>
          </Space>
        ) : (
          '—'
        )
    },
    {
      title: 'Menor já visto (keyshop)',
      key: 'lowestKeyshop',
      render: (_: unknown, row: Row) =>
        row.price?.localLowestKeyshop ? (
          <Space direction="vertical" size={0}>
            <Text strong>{formatPrice(row.price.currency, row.price.localLowestKeyshop)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              em {formatDate(row.price.localLowestKeyshopAt)}
            </Text>
          </Space>
        ) : (
          '—'
        )
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      render: (_: unknown, row: Row) => (
        <Popconfirm
          title="Remover da wishlist?"
          onConfirm={() => removeItem.mutate(row.item.appId)}
          okText="Remover"
          cancelText="Cancelar"
        >
          <Button
            icon={<DeleteOutlined />}
            danger
            type="text"
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Wishlist
          {wishlist.length > 0 && (
            <Tag color="blue">{filterTerm ? `${rows.length} de ${wishlist.length}` : wishlist.length} jogos</Tag>
          )}
        </Title>
        <Space>
          <Tooltip
            title={
              settings?.steamId64
                ? 'Busca sua wishlist direto da Steam (a primeira vez pode demorar por causa do limite deles).'
                : 'Configure seu SteamID64 em Configurações primeiro.'
            }
          >
            <Button
              icon={<CloudSyncOutlined />}
              loading={syncFromSteam.isPending}
              disabled={!settings?.steamId64}
              onClick={() =>
                syncFromSteam.mutate(undefined, {
                  onSuccess: (items) => message.success(`Wishlist sincronizada: ${items.length} jogos.`),
                  onError: (error) => message.error(error instanceof Error ? error.message : 'Falha ao sincronizar com a Steam.')
                })
              }
            >
              Sincronizar com a Steam
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={refreshPrices.isPending}
            disabled={wishlist.length === 0}
            onClick={() =>
              refreshPrices.mutate(undefined, {
                onError: (error) => message.error(error instanceof Error ? error.message : 'Falha ao atualizar preços.')
              })
            }
          >
            Atualizar preços
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <AutoComplete
          style={{ width: 360 }}
          value={addSearchTerm}
          onChange={setAddSearchTerm}
          onSelect={(_, option) => {
            addItem.mutate(option.appId as number)
            setAddSearchTerm('')
          }}
          options={searchResults.map((result) => ({
            value: result.name,
            appId: result.appId,
            label: (
              <Space>
                {result.tinyImageUrl && <Avatar shape="square" size="small" src={result.tinyImageUrl} />}
                {result.name}
              </Space>
            )
          }))}
          notFoundContent={isSearching ? 'Buscando...' : null}
          placeholder="Buscar jogo na Steam pra adicionar à wishlist..."
        />

        <Input
          style={{ width: 260 }}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Filtrar sua wishlist..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
        />
      </Space>

      <Table<Row>
        rowKey={(row) => row.item.appId}
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 15 }}
        onRow={(row) => ({
          style: { cursor: 'pointer' },
          onClick: () => navigate(`/game/${row.item.appId}`)
        })}
      />
    </div>
  )
}
