import { Alert, Avatar, Button, Table, Typography } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useLibrary, useSyncLibrary } from '@renderer/hooks/useLibrary'
import { useSettings } from '@renderer/hooks/useSettings'
import type { OwnedGame } from '@shared/types'

const { Title } = Typography

export function LibraryPage() {
  const { data: settings } = useSettings()
  const { data: games = [], isLoading } = useLibrary()
  const syncLibrary = useSyncLibrary()

  const columns = [
    {
      title: '',
      dataIndex: 'iconUrl',
      width: 48,
      render: (iconUrl: string | undefined) => <Avatar shape="square" src={iconUrl} />
    },
    { title: 'Jogo', dataIndex: 'name', key: 'name' },
    {
      title: 'Horas jogadas',
      dataIndex: 'playtimeForeverMinutes',
      key: 'playtime',
      render: (minutes: number) => `${(minutes / 60).toFixed(1)}h`,
      sorter: (a: OwnedGame, b: OwnedGame) => a.playtimeForeverMinutes - b.playtimeForeverMinutes
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Minha biblioteca Steam
        </Title>
        <Button
          type="primary"
          icon={<SyncOutlined />}
          loading={syncLibrary.isPending}
          disabled={!settings?.steamId64}
          onClick={() => syncLibrary.mutate()}
        >
          Sincronizar com a Steam
        </Button>
      </div>

      {!settings?.steamId64 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <>
              Configure seu SteamID64 em <Link to="/settings">Configurações</Link> para sincronizar.
            </>
          }
        />
      )}

      <Table
        rowKey="appId"
        loading={isLoading}
        dataSource={games}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
