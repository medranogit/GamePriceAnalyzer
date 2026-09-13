import { useState } from 'react'
import { Button, Input, Popconfirm, Table, Tag, Tooltip, Typography, message } from 'antd'
import { CloudSyncOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useRemoveWishlistItem, useSyncSteamWishlist, useWishlist } from '@renderer/hooks/useWishlist'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimersStatus } from '@renderer/hooks/useQueues'
import { matchesSearchTokens } from '@renderer/lib/matchesSearchTokens'
import { formatDate } from '@renderer/lib/formatters'
import type { WishlistItem } from '@shared/types'

const { Title } = Typography

export function WishlistPage() {
  const { data: settings } = useSettings()
  const { data: wishlist = [], isLoading } = useWishlist()
  const removeItem = useRemoveWishlistItem()
  const syncFromSteam = useSyncSteamWishlist()
  const { data: timers = [] } = useTimersStatus()
  // Reflete o scheduler de verdade (main process), não só o mutation local — assim o botão aparece
  // "rodando" mesmo se a sincronização foi forçada pela tela Fila de Chamadas, não só por aqui.
  const wishlistSyncRunning = timers.find((timer) => timer.key === 'wishlist')?.running ?? false

  const [filterTerm, setFilterTerm] = useState('')

  const rows = wishlist.filter((item) => matchesSearchTokens(item.title, filterTerm))

  const columns = [
    {
      title: 'Jogo',
      key: 'title',
      sorter: (a: WishlistItem, b: WishlistItem) => a.title.localeCompare(b.title),
      render: (_: unknown, item: WishlistItem) => item.title
    },
    {
      title: 'Adicionado em',
      key: 'addedDate',
      width: 160,
      sorter: (a: WishlistItem, b: WishlistItem) =>
        new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime(),
      render: (_: unknown, item: WishlistItem) => formatDate(item.addedDate)
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      render: (_: unknown, item: WishlistItem) => (
        <Popconfirm
          title="Remover da wishlist?"
          onConfirm={() => removeItem.mutate(item.appId)}
          okText="Remover"
          cancelText="Cancelar"
        >
          <Button icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      )
    }
  ]

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
      >
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Wishlist
          {wishlist.length > 0 && (
            <Tag color="blue">
              {filterTerm ? `${rows.length} de ${wishlist.length}` : wishlist.length} jogos
            </Tag>
          )}
        </Title>
        <Tooltip
          title={
            settings?.steamId64
              ? 'Busca sua wishlist direto da Steam (a primeira vez pode demorar por causa do limite deles).'
              : 'Configure seu SteamID64 em Configurações primeiro.'
          }
        >
          <Button
            icon={<CloudSyncOutlined />}
            loading={syncFromSteam.isPending || wishlistSyncRunning}
            disabled={!settings?.steamId64}
            onClick={() =>
              syncFromSteam.mutate(undefined, {
                onSuccess: (items) => message.success(`Wishlist sincronizada: ${items.length} jogos.`),
                onError: (error) =>
                  message.error(error instanceof Error ? error.message : 'Falha ao sincronizar com a Steam.')
              })
            }
          >
            Sincronizar com a Steam
          </Button>
        </Tooltip>
      </div>

      <Input
        style={{ width: 260, marginBottom: 16 }}
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Filtrar sua wishlist..."
        value={filterTerm}
        onChange={(e) => setFilterTerm(e.target.value)}
      />

      <Table<WishlistItem>
        size="small"
        rowKey={(item) => item.appId}
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
