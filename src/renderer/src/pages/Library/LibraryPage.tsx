import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography
} from 'antd'
import { SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { useLibrary, useSyncLibrary } from '@renderer/hooks/useLibrary'
import { useMetadataCache } from '@renderer/hooks/useMetadata'
import { useSettings } from '@renderer/hooks/useSettings'
import { matchesSearchTokens } from '@renderer/lib/matchesSearchTokens'
import { getGenreIcon } from '@renderer/lib/genreIcons'
import {
  LibraryGameCard,
  type LibraryGameCardData
} from '@renderer/components/LibraryGameCard/LibraryGameCard'

const { Title, Text } = Typography

const PAGE_SIZE = 24

type SortOption = 'playtime-desc' | 'playtime-asc' | 'name-asc'

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
`

const FiltersGroup = styled(Space)`
  flex-wrap: wrap;
`

export function LibraryPage() {
  const { data: settings } = useSettings()
  const { data: games = [], isLoading } = useLibrary()
  const { data: metadataList = [] } = useMetadataCache()
  const syncLibrary = useSyncLibrary()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [sortOption, setSortOption] = useState<SortOption>('playtime-desc')
  const [currentPage, setCurrentPage] = useState(1)

  const metadataByAppId = useMemo(
    () => new Map(metadataList.map((metadata) => [metadata.appId, metadata])),
    [metadataList]
  )

  const enrichedGames: LibraryGameCardData[] = useMemo(
    () =>
      games.map((game) => {
        const metadata = metadataByAppId.get(game.appId)
        return {
          appId: game.appId,
          title: game.name,
          coverUrl: metadata?.headerImageUrl ?? game.iconUrl,
          genres: metadata?.genres ?? [],
          playtimeForeverMinutes: game.playtimeForeverMinutes
        }
      }),
    [games, metadataByAppId]
  )

  const genreCounts = new Map<string, number>()
  for (const game of enrichedGames) {
    for (const genre of game.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
  }
  const availableGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre)

  const filteredGames = enrichedGames
    .filter((game) => matchesSearchTokens(game.title, searchTerm))
    .filter(
      (game) => selectedGenres.length === 0 || game.genres.some((genre) => selectedGenres.includes(genre))
    )

  const sortedGames = [...filteredGames].sort((a, b) => {
    if (sortOption === 'name-asc') return a.title.localeCompare(b.title)
    if (sortOption === 'playtime-asc') return a.playtimeForeverMinutes - b.playtimeForeverMinutes
    return b.playtimeForeverMinutes - a.playtimeForeverMinutes
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedGenres, sortOption, games])

  const pagedGames = sortedGames.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div>
      <TopRow>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          Minha biblioteca Steam
          {games.length > 0 && (
            <Tag color="blue">
              {filteredGames.length !== games.length
                ? `${filteredGames.length} de ${games.length}`
                : games.length}{' '}
              jogos
            </Tag>
          )}
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
      </TopRow>

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

      <Card size="small" style={{ marginBottom: 16 }}>
        <TopRow style={{ margin: 0 }}>
          <Input
            style={{ width: 280 }}
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Filtrar sua biblioteca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <FiltersGroup size="large" align="center">
            <Space direction="vertical" size={0}>
              <Text type="secondary">Gêneros</Text>
              <Select
                mode="multiple"
                allowClear
                style={{ minWidth: 200, maxWidth: 320 }}
                placeholder="Todos os gêneros"
                value={selectedGenres}
                onChange={setSelectedGenres}
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

            <Space direction="vertical" size={0}>
              <Text type="secondary">Ordenar por</Text>
              <Select
                style={{ width: 200 }}
                value={sortOption}
                onChange={setSortOption}
                options={[
                  { value: 'playtime-desc', label: 'Mais jogado primeiro' },
                  { value: 'playtime-asc', label: 'Menos jogado primeiro' },
                  { value: 'name-asc', label: 'Nome (A-Z)' }
                ]}
              />
            </Space>
          </FiltersGroup>
        </TopRow>
      </Card>

      {isLoading ? (
        <Spin />
      ) : sortedGames.length === 0 ? (
        <Empty description="Nenhum jogo encontrado. Sincronize sua biblioteca com a Steam." />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {pagedGames.map((game) => (
              <Col key={game.appId} xs={24} sm={12} md={8} lg={6}>
                <LibraryGameCard game={game} />
              </Col>
            ))}
          </Row>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              total={sortedGames.length}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  )
}
