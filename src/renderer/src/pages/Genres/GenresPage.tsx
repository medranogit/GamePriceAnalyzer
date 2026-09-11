import { Card, Col, Empty, Row, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useDeals } from '@renderer/hooks/useDeals'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import { GameCover } from '@renderer/components/GameCover/GameCover'

const { Title, Text } = Typography

interface GenreSummary {
  name: string
  coverUrl?: string
  count: number
}

export function GenresPage() {
  const { data: deals = [] } = useDeals()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const navigate = useNavigate()

  const genresMap = new Map<string, GenreSummary>()
  for (const deal of deals) {
    for (const genre of deal.genres) {
      const existing = genresMap.get(genre)
      if (existing) {
        existing.count += 1
        existing.coverUrl ??= deal.coverUrl
      } else {
        genresMap.set(genre, { name: genre, coverUrl: deal.coverUrl, count: 1 })
      }
    }
  }
  const genres = [...genresMap.values()].sort((a, b) => b.count - a.count)

  const handleSelectGenre = (genre: string): void => {
    if (!settings) return
    updateSettings.mutate({ filters: { ...settings.filters, selectedGenres: [genre] } })
    navigate('/')
  }

  return (
    <div>
      <Title level={3}>Gêneros</Title>
      {genres.length === 0 ? (
        <Empty description="Busque ofertas primeiro para ver os gêneros disponíveis." />
      ) : (
        <Row gutter={[16, 16]}>
          {genres.map((genre) => (
            <Col key={genre.name} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                cover={<GameCover url={genre.coverUrl} height={120} />}
                onClick={() => handleSelectGenre(genre.name)}
              >
                <Card.Meta title={genre.name} description={<Text type="secondary">{genre.count} ofertas</Text>} />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
