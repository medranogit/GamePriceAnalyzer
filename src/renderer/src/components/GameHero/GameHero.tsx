import { useState, type ReactNode } from 'react'
import { Image, Modal, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  CloseOutlined,
  CodeOutlined,
  LeftOutlined,
  PlayCircleFilled,
  RightOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { GameCover } from '@renderer/components/GameCover/GameCover'
import { HlsVideo } from '@renderer/components/HlsVideo/HlsVideo'
import { formatCount } from '@renderer/lib/formatters'
import type { GameTrailer } from '@shared/types'

const { Title, Text } = Typography

const Hero = styled.div`
  position: relative;
  margin-bottom: 16px;
`

const HeroScrim = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: linear-gradient(to top, rgba(15, 17, 21, 0.95), rgba(15, 17, 21, 0) 55%);
`

const HeroTitle = styled(Title)`
  &&& {
    position: absolute;
    left: 20px;
    bottom: 14px;
    margin: 0;
    color: #fff;
  }
`

const CreditsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
`

const CreditLine = styled(Text)`
  &&& {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 13px;
  }
`

const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
`

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 8px 14px;
`

const StatIconBadge = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 14px;
  color: ${({ $accent }) => $accent};
  background: ${({ $accent }) => $accent}26;
`

const StatLabel = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 11px;
    line-height: 1.3;
  }
`

const StatValue = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
`

const GenresRow = styled.div`
  margin-bottom: 16px;
`

const GalleryColumns = styled.div<{ $singleColumn: boolean }>`
  display: grid;
  grid-template-columns: ${({ $singleColumn }) => ($singleColumn ? '1fr' : '1fr 1fr')};
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`

const GalleryColumnTitle = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
    margin-bottom: 6px;
  }
`

const CarouselContainer = styled.div`
  position: relative;
  height: 220px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surfaceRaised};
`

const CarouselSlide = styled.div<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  position: relative;
  width: 100%;
  height: 100%;
`

const CarouselArrow = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === 'left' ? 'left: 8px;' : 'right: 8px;')}
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
`

const CarouselDots = styled.div`
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 2;
`

const CarouselDot = styled.button<{ $active: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.4)')};
`

const SlideThumbnail = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const SlidePlayOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.15);
`

const SlidePlayIcon = styled(PlayCircleFilled)`
  font-size: 48px;
  color: #fff;
  filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.6));
`

const ModalVideoWrapper = styled.div`
  position: relative;
`

const ModalVideo = styled(HlsVideo)`
  display: block;
  width: 100%;
  max-height: 70vh;
  background: #000;
`

const ModalCloseIcon = styled(CloseOutlined)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
`

const RELEASE_DATE_ACCENT = '#1fa89e'
const REVIEWS_ACCENT = '#9254de'

function metacriticColor(score: number): string {
  if (score >= 75) return '#3fb950'
  if (score >= 50) return '#d4a72c'
  return '#f85149'
}

interface SimpleCarouselProps<T> {
  items: T[]
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactNode
}

/**
 * Carrossel próprio em vez do `Carousel` do antd — ele quebrava dentro do grid de 2 colunas (renderizava
 * todos os slides empilhados um embaixo do outro, sem esconder os inativos). Só um slide fica montado
 * como visível por vez (display none/block), sem depender de nenhuma lib externa de posicionamento.
 */
function SimpleCarousel<T>({ items, keyOf, renderItem }: SimpleCarouselProps<T>) {
  const [index, setIndex] = useState(0)
  const activeIndex = index < items.length ? index : 0

  return (
    <CarouselContainer>
      {items.map((item, i) => (
        <CarouselSlide key={keyOf(item)} $visible={i === activeIndex}>
          {renderItem(item)}
        </CarouselSlide>
      ))}

      {items.length > 1 && (
        <>
          <CarouselArrow
            type="button"
            $side="left"
            aria-label="Anterior"
            onClick={() => setIndex((activeIndex - 1 + items.length) % items.length)}
          >
            <LeftOutlined />
          </CarouselArrow>
          <CarouselArrow
            type="button"
            $side="right"
            aria-label="Próximo"
            onClick={() => setIndex((activeIndex + 1) % items.length)}
          >
            <RightOutlined />
          </CarouselArrow>
          <CarouselDots>
            {items.map((item, i) => (
              <CarouselDot
                key={keyOf(item)}
                type="button"
                aria-label={`Ir pro item ${i + 1}`}
                $active={i === activeIndex}
                onClick={() => setIndex(i)}
              />
            ))}
          </CarouselDots>
        </>
      )}
    </CarouselContainer>
  )
}

interface GameHeroProps {
  title: string
  coverUrl?: string
  genres: string[]
  developers: string[]
  publishers: string[]
  releaseDate: string | null
  metacriticScore: number | null
  recommendationsTotal: number | null
  shortDescription: string | null
  trailers: GameTrailer[]
  screenshots: string[]
}

export function GameHero({
  title,
  coverUrl,
  genres,
  developers,
  publishers,
  releaseDate,
  metacriticScore,
  recommendationsTotal,
  shortDescription,
  trailers,
  screenshots
}: GameHeroProps) {
  const [activeTrailerIndex, setActiveTrailerIndex] = useState<number | null>(null)
  const activeTrailer = activeTrailerIndex !== null ? trailers[activeTrailerIndex] : null
  const showPublishers = publishers.length > 0 && publishers.join(',') !== developers.join(',')
  const galleryImages = coverUrl ? [coverUrl, ...screenshots.filter((url) => url !== coverUrl)] : screenshots

  return (
    <>
      <Hero>
        <GameCover url={coverUrl} height={260} radius={10} />
        <HeroScrim />
        <HeroTitle level={2}>{title}</HeroTitle>
      </Hero>

      {(developers.length > 0 || showPublishers) && (
        <CreditsColumn>
          {developers.length > 0 && (
            <CreditLine>
              <CodeOutlined /> Desenvolvido por {developers.join(', ')}
            </CreditLine>
          )}
          {showPublishers && (
            <CreditLine>
              <ShopOutlined /> Publicado por {publishers.join(', ')}
            </CreditLine>
          )}
        </CreditsColumn>
      )}

      <StatsRow>
        {releaseDate && (
          <StatCard>
            <StatIconBadge $accent={RELEASE_DATE_ACCENT}>
              <CalendarOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Lançamento</StatLabel>
              <StatValue>{releaseDate}</StatValue>
            </div>
          </StatCard>
        )}

        {metacriticScore !== null && (
          <StatCard>
            <StatIconBadge $accent={metacriticColor(metacriticScore)}>
              <StarOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Metacritic</StatLabel>
              <StatValue>{metacriticScore}</StatValue>
            </div>
          </StatCard>
        )}

        {recommendationsTotal !== null && (
          <StatCard>
            <StatIconBadge $accent={REVIEWS_ACCENT}>
              <TeamOutlined />
            </StatIconBadge>
            <div>
              <StatLabel>Avaliações na Steam</StatLabel>
              <StatValue>{formatCount(recommendationsTotal)}</StatValue>
            </div>
          </StatCard>
        )}
      </StatsRow>

      <GenresRow>
        {genres.map((genre) => (
          <Tag key={genre}>{genre}</Tag>
        ))}
      </GenresRow>

      {shortDescription && <Text style={{ display: 'block', marginBottom: 16 }}>{shortDescription}</Text>}

      {(trailers.length > 0 || galleryImages.length > 0) && (
        <GalleryColumns $singleColumn={trailers.length === 0 || galleryImages.length === 0}>
          {trailers.length > 0 && (
            <div>
              <GalleryColumnTitle>Trailers</GalleryColumnTitle>
              <SimpleCarousel
                items={trailers}
                keyOf={(trailer) => trailer.url}
                renderItem={(trailer) => (
                  <>
                    <SlideThumbnail src={trailer.thumbnailUrl ?? coverUrl} alt={title} />
                    <SlidePlayOverlay onClick={() => setActiveTrailerIndex(trailers.indexOf(trailer))}>
                      <SlidePlayIcon />
                    </SlidePlayOverlay>
                  </>
                )}
              />
            </div>
          )}

          {galleryImages.length > 0 && (
            <div>
              <GalleryColumnTitle>Imagens</GalleryColumnTitle>
              <Image.PreviewGroup items={galleryImages}>
                <SimpleCarousel
                  items={galleryImages}
                  keyOf={(url) => url}
                  renderItem={(url) => (
                    <Image
                      src={url}
                      width="100%"
                      height={220}
                      style={{ objectFit: 'cover' }}
                      wrapperStyle={{ width: '100%', height: '100%' }}
                    />
                  )}
                />
              </Image.PreviewGroup>
            </div>
          )}
        </GalleryColumns>
      )}

      <Modal
        open={activeTrailer !== null}
        onCancel={() => setActiveTrailerIndex(null)}
        footer={null}
        width={800}
        destroyOnClose
        centered
        closeIcon={<ModalCloseIcon />}
      >
        {activeTrailer && activeTrailerIndex !== null && (
          <ModalVideoWrapper>
            <ModalVideo
              key={activeTrailer.url}
              src={activeTrailer.url}
              poster={activeTrailer.thumbnailUrl ?? coverUrl}
              autoPlay
            />
            {trailers.length > 1 && (
              <>
                <CarouselArrow
                  type="button"
                  $side="left"
                  aria-label="Trailer anterior"
                  onClick={() =>
                    setActiveTrailerIndex((activeTrailerIndex - 1 + trailers.length) % trailers.length)
                  }
                >
                  <LeftOutlined />
                </CarouselArrow>
                <CarouselArrow
                  type="button"
                  $side="right"
                  aria-label="Próximo trailer"
                  onClick={() => setActiveTrailerIndex((activeTrailerIndex + 1) % trailers.length)}
                >
                  <RightOutlined />
                </CarouselArrow>
              </>
            )}
          </ModalVideoWrapper>
        )}
      </Modal>
    </>
  )
}
