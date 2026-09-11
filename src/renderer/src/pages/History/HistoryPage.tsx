import { Button, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { useHistory } from '@renderer/hooks/useHistory'
import type { HistoryEvent, HistoryEventType } from '@shared/types'

const { Title } = Typography

const TYPE_LABELS: Record<HistoryEventType, string> = {
  deal_found: 'Oferta',
  library_sync: 'Biblioteca',
  wishlist_import: 'Wishlist',
  wishlist_add: 'Wishlist',
  wishlist_remove: 'Wishlist',
  error: 'Erro'
}

const TYPE_COLORS: Record<HistoryEventType, string> = {
  deal_found: 'green',
  library_sync: 'blue',
  wishlist_import: 'purple',
  wishlist_add: 'cyan',
  wishlist_remove: 'orange',
  error: 'red'
}

const columns = [
  {
    title: 'Tipo',
    dataIndex: 'type',
    key: 'type',
    width: 130,
    render: (type: HistoryEventType) => <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Tag>
  },
  {
    title: 'Data/hora',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 170,
    render: (timestamp: string) => dayjs(timestamp).format('DD/MM/YYYY, HH:mm:ss'),
    sorter: (a: HistoryEvent, b: HistoryEvent) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf(),
    defaultSortOrder: 'descend' as const
  },
  {
    title: 'Mensagem',
    dataIndex: 'message',
    key: 'message'
  }
]

export function HistoryPage() {
  const { data: events = [], isLoading } = useHistory()
  const queryClient = useQueryClient()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Histórico
          {events.length > 0 && <Tag color="blue">{events.length}</Tag>}
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['history'] })}
        >
          Recarregar
        </Button>
      </div>

      <Table<HistoryEvent>
        rowKey="id"
        loading={isLoading}
        dataSource={events}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
