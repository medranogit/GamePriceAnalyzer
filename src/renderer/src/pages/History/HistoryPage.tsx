import { useMemo, useState } from 'react'
import { Button, Modal, Table, Tabs, Tag, Typography, message } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { useHistory, useRemoveHistoryEvents } from '@renderer/hooks/useHistory'
import { useLibrary } from '@renderer/hooks/useLibrary'
import { useWishlist } from '@renderer/hooks/useWishlist'
import { useDeals } from '@renderer/hooks/useDeals'
import type { HistoryEvent, HistoryEventType } from '@shared/types'

const { Title } = Typography

type HistoryTab = 'biblioteca' | 'wishlist' | 'ofertas'

const TYPE_LABELS: Record<HistoryEventType, string> = {
  deal_found: 'Oferta',
  library_sync: 'Biblioteca',
  wishlist_import: 'Wishlist',
  wishlist_add: 'Wishlist',
  wishlist_remove: 'Wishlist',
  offers_sync: 'Ofertas',
  metadata_backfill: 'Backfill',
  metadata_refresh: 'Sobrescrever tudo',
  error: 'Erro'
}

const TYPE_COLORS: Record<HistoryEventType, string> = {
  deal_found: 'green',
  library_sync: 'blue',
  wishlist_import: 'purple',
  wishlist_add: 'cyan',
  wishlist_remove: 'orange',
  offers_sync: 'gold',
  metadata_backfill: 'geekblue',
  metadata_refresh: 'magenta',
  error: 'red'
}

/** Tipos exclusivos de uma área — não dependem de onde o jogo está agora. */
const FIXED_TAB_BY_TYPE: Partial<Record<HistoryEventType, HistoryTab>> = {
  library_sync: 'biblioteca',
  wishlist_import: 'wishlist',
  wishlist_add: 'wishlist',
  wishlist_remove: 'wishlist',
  offers_sync: 'ofertas',
  deal_found: 'ofertas'
}

/**
 * Backfill e "Sobrescrever tudo" rodam por-jogo em cima de wishlist + biblioteca ao mesmo tempo — não dá
 * pra saber a aba certa só pelo tipo do evento. Em vez disso, cada evento carrega o appId do jogo, e essa
 * função olha onde esse jogo está cacheado *agora* (biblioteca > wishlist > ofertas) pra decidir a aba.
 * Um evento assim sem correspondência em nenhuma lista atual (jogo removido depois) não aparece em nenhuma aba.
 */
function resolveTab(
  event: HistoryEvent,
  lookup: { ownedAppIds: Set<number>; wishlistAppIds: Set<number>; dealAppIds: Set<number> }
): HistoryTab | null {
  const fixedTab = FIXED_TAB_BY_TYPE[event.type]
  if (fixedTab) return fixedTab

  if (event.appId == null) return null
  if (lookup.ownedAppIds.has(event.appId)) return 'biblioteca'
  if (lookup.wishlistAppIds.has(event.appId)) return 'wishlist'
  if (lookup.dealAppIds.has(event.appId)) return 'ofertas'
  return null
}

/** Casa cada par "valor antigo → valor novo" de `logPriceChanges` (ex: "BRL 35.85 → BRL 30.68" ou "sem
 * oferta → BRL 30.68") — usado só pra colorir preço antigo/novo na mensagem, sem mudar o texto salvo. */
const PRICE_ARROW_REGEX = /(sem oferta|\S+ [\d.,]+) → (sem oferta|\S+ [\d.,]+)/g

/** Mensagens de "Preço atualizado" ganham cor (vermelho no valor antigo, verde no novo) e trocam a
 * vírgula entre loja/keyshop por " | " — pra ficar mais fácil de escanear visualmente. Mensagens sem
 * esse padrão (a maioria) voltam inalteradas. */
function renderMessage(message: string) {
  const parts = message.split(PRICE_ARROW_REGEX)
  if (parts.length === 1) return message

  return parts.map((part, index) => {
    const position = index % 3
    if (position === 1) {
      return (
        <span key={index} style={{ color: '#ff4d4f' }}>
          {part}
        </span>
      )
    }
    if (position === 2) {
      return (
        <span key={index}>
          {' → '}
          <span style={{ color: '#52c41a' }}>{part}</span>
        </span>
      )
    }
    return <span key={index}>{part.replace(/^, /, ' | ')}</span>
  })
}

const columns = [
  {
    title: 'Tipo',
    dataIndex: 'type',
    key: 'type',
    width: 150,
    render: (type: HistoryEventType) => <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Tag>
  },
  {
    title: 'Data/hora',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 170,
    render: (timestamp: string) => dayjs(timestamp).format('DD/MM/YYYY, HH:mm:ss')
  },
  {
    title: 'Mensagem',
    dataIndex: 'message',
    key: 'message',
    render: renderMessage
  }
]

const TAB_LABELS: Record<HistoryTab, string> = {
  biblioteca: 'Minha Biblioteca',
  ofertas: 'Ofertas',
  wishlist: 'Wishlist'
}

export function HistoryPage() {
  const { data: events = [], isLoading } = useHistory()
  const { data: ownedGames = [] } = useLibrary()
  const { data: wishlist = [] } = useWishlist()
  const { data: deals = [] } = useDeals()
  const queryClient = useQueryClient()
  const removeEvents = useRemoveHistoryEvents()
  const [activeTab, setActiveTab] = useState<HistoryTab>('biblioteca')

  const lookup = useMemo(
    () => ({
      ownedAppIds: new Set(ownedGames.map((game) => game.appId)),
      wishlistAppIds: new Set(wishlist.map((item) => item.appId)),
      dealAppIds: new Set(deals.filter((deal) => deal.appId !== null).map((deal) => deal.appId as number))
    }),
    [ownedGames, wishlist, deals]
  )

  const eventsByTab = useMemo(() => {
    const grouped: Record<HistoryTab, HistoryEvent[]> = { biblioteca: [], wishlist: [], ofertas: [] }
    for (const event of events) {
      const tab = resolveTab(event, lookup)
      if (tab) grouped[tab].push(event)
    }
    return grouped
  }, [events, lookup])

  const tabs = [
    { key: 'biblioteca', label: 'Minha Biblioteca', events: eventsByTab.biblioteca },
    { key: 'ofertas', label: 'Ofertas', events: eventsByTab.ofertas },
    { key: 'wishlist', label: 'Wishlist', events: eventsByTab.wishlist }
  ]

  const activeTabEvents = eventsByTab[activeTab]

  const handleClearActiveTab = (): void => {
    Modal.confirm({
      title: `Limpar o log de "${TAB_LABELS[activeTab]}"?`,
      content: `Isso remove permanentemente ${activeTabEvents.length} evento(s) dessa aba do Histórico. Não afeta as outras abas.`,
      okText: 'Limpar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => {
        removeEvents.mutate(
          activeTabEvents.map((event) => event.id),
          {
            onSuccess: () => message.success(`Log de "${TAB_LABELS[activeTab]}" limpo.`),
            onError: (error) =>
              message.error(error instanceof Error ? error.message : 'Falha ao limpar o log.')
          }
        )
      }
    })
  }

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
      >
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Histórico
          {events.length > 0 && <Tag color="blue">{events.length}</Tag>}
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={removeEvents.isPending}
            disabled={activeTabEvents.length === 0}
            onClick={handleClearActiveTab}
          >
            Limpar log de &quot;{TAB_LABELS[activeTab]}&quot;
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['history'] })}
          >
            Recarregar
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as HistoryTab)}
        items={tabs.map(({ key, label, events: tabEvents }) => ({
          key,
          label: (
            <>
              {label} <Tag>{tabEvents.length}</Tag>
            </>
          ),
          children: (
            <Table<HistoryEvent>
              size="small"
              rowKey="id"
              loading={isLoading}
              dataSource={tabEvents}
              columns={columns}
              pagination={{ pageSize: 50 }}
            />
          )
        }))}
      />
    </div>
  )
}
