import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Modal, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  CaretLeftFilled,
  CaretRightFilled,
  CodeOutlined,
  LeftOutlined,
  PlayCircleFilled,
  RightOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { HlsVideo } from '@renderer/components/HlsVideo/HlsVideo'
import { formatCount } from '@renderer/lib/formatters'
import type { GameTrailer } from '@shared/types'

const { Title, Text } = Typography

const PageTitle = styled(Title)`
  &&& {
    margin: 0 0 12px;
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

const CarouselTrack = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  height: 100%;
`

const CarouselSlide = styled.div`
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
`

const CarouselArrow = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 0;
  bottom: 0;
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')}
  width: 40px;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  &:disabled {
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.4);
    cursor: default;
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

const LightboxWrapper = styled.div`
  position: relative;
  padding: 24px 64px;
  background: #000;
  border-radius: 12px;
`

const LightboxVideo = styled(HlsVideo)`
  display: block;
  width: 100%;
  max-height: 65vh;
  background: #000;
  border-radius: 8px;
`

const LightboxImage = styled.img`
  display: block;
  width: 100%;
  max-height: 65vh;
  object-fit: contain;
  background: #000;
  border-radius: 8px;
`

const LightboxArrow = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 0;
  bottom: 0;
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')}
  width: 64px;
  border: none;
  padding: 0;
  background: transparent;
  color: #fff;
  font-size: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;

  &:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.6);
  }

  &:disabled {
    opacity: 0.25;
    cursor: default;
  }
`

const RELEASE_DATE_ACCENT = '#1fa89e'
const REVIEWS_ACCENT = '#9254de'

function metacriticColor(score: number): string {
  if (score >= 75) return '#3fb950'
  if (score >= 50) return '#d4a72c'
  return '#f85149'
}

const CAROUSEL_DEFAULT_BREAKPOINT_WIDTH = 480

/** Mede a largura real do próprio carrossel (não a da janela) — assim ele decide quantos itens mostrar
 * por vez com base no espaço que realmente tem disponível, correto tanto no grid de 2 colunas quanto numa
 * coluna só (onde o carrossel de imagens pode mostrar mais itens por vez, por ter o dobro do espaço). */
function useCarouselItemsPerView(
  containerRef: RefObject<HTMLDivElement | null>,
  smallItemsPerView: number,
  largeItemsPerView: number,
  breakpointWidth: number
): number {
  const [itemsPerView, setItemsPerView] = useState(smallItemsPerView)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      setItemsPerView(entry.contentRect.width >= breakpointWidth ? largeItemsPerView : smallItemsPerView)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, smallItemsPerView, largeItemsPerView, breakpointWidth])

  return itemsPerView
}

interface SimpleCarouselProps<T> {
  items: T[]
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Quantos itens mostrar por vez em tela pequena / grande, e a largura (px) do próprio carrossel que
   * separa as duas — por padrão 1 em tela pequena, 2 em tela grande. */
  smallItemsPerView?: number
  largeItemsPerView?: number
  breakpointWidth?: number
}

/**
 * Carrossel próprio em vez do `Carousel` do antd — ele quebrava dentro do grid de 2 colunas (renderizava
 * todos os slides empilhados um embaixo do outro, sem esconder os inativos). Navega por página, sem
 * depender de nenhuma lib externa.
 */
function SimpleCarousel<T>({
  items,
  keyOf,
  renderItem,
  smallItemsPerView = 1,
  largeItemsPerView = 2,
  breakpointWidth = CAROUSEL_DEFAULT_BREAKPOINT_WIDTH
}: SimpleCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemsPerView = useCarouselItemsPerView(
    containerRef,
    smallItemsPerView,
    largeItemsPerView,
    breakpointWidth
  )
  const pageCount = Math.max(1, Math.ceil(items.length / itemsPerView))
  const [page, setPage] = useState(0)
  const activePage = page < pageCount ? page : 0
  const startIndex = activePage * itemsPerView
  const visibleItems = items.slice(startIndex, startIndex + itemsPerView)

  return (
    <CarouselContainer ref={containerRef}>
      <CarouselTrack>
        {visibleItems.map((item) => (
          <CarouselSlide key={keyOf(item)}>{renderItem(item)}</CarouselSlide>
        ))}
      </CarouselTrack>

      {pageCount > 1 && (
        <>
          <CarouselArrow
            type="button"
            $side="left"
            aria-label="Anterior"
            disabled={activePage === 0}
            onClick={() => setPage(activePage - 1)}
          >
            <LeftOutlined />
          </CarouselArrow>
          <CarouselArrow
            type="button"
            $side="right"
            aria-label="Próximo"
            disabled={activePage === pageCount - 1}
            onClick={() => setPage(activePage + 1)}
          >
            <RightOutlined />
          </CarouselArrow>
          <CarouselDots>
            {Array.from({ length: pageCount }, (_, i) => (
              <CarouselDot
                key={i}
                type="button"
                aria-label={`Ir pra página ${i + 1}`}
                $active={i === activePage}
                onClick={() => setPage(i)}
              />
            ))}
          </CarouselDots>
        </>
      )}
    </CarouselContainer>
  )
}

type MediaItem = { type: 'video'; trailer: GameTrailer } | { type: 'image'; url: string }

/** Só as URLs locais (`app-image://`/`app-video://`) indicam um arquivo baixado que pode ter sumido da
 * pasta de mídia — uma URL remota (https://) falhando é só uma instabilidade de rede passageira, não
 * justifica forçar uma busca de metadata inteira de novo. */
function isLocalMediaUrl(url: string | undefined): boolean {
  return url?.startsWith('app-image://') === true || url?.startsWith('app-video://') === true
}

const MAX_IMAGE_RETRIES = 3
const IMAGE_RETRY_DELAY_MS = 700

/** Um arquivo local recém-baixado às vezes não está pronto pra leitura na hora (ex: antivírus escaneando
 * o arquivo assim que é criado) — tenta de novo algumas vezes com um pequeno atraso antes de considerar
 * que a imagem realmente sumiu. Trocar o `key` força o `<img>` a ser recriado, garantindo uma tentativa
 * de rede nova (em vez do navegador possivelmente ignorar uma nova tentativa pro mesmo `src`). */
function useImageRetry(
  src: string | undefined,
  refreshToken: number,
  onGiveUp?: () => void
): { retryKey: string; handleError: () => void } {
  const retriesRef = useRef(0)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    retriesRef.current = 0
    setRetryTick(0)
  }, [src, refreshToken])

  const handleError = (): void => {
    if (retriesRef.current < MAX_IMAGE_RETRIES) {
      retriesRef.current += 1
      setTimeout(() => setRetryTick((tick) => tick + 1), IMAGE_RETRY_DELAY_MS)
    } else {
      onGiveUp?.()
    }
  }

  return { retryKey: `${src ?? ''}-${refreshToken}-${retryTick}`, handleError }
}

function RetryableTrailerThumbnail({
  trailer,
  coverUrl,
  title,
  mediaRefreshToken,
  onLocalMediaMissing
}: {
  trailer: GameTrailer
  coverUrl?: string
  title: string
  mediaRefreshToken: number
  onLocalMediaMissing?: () => void
}) {
  const src = trailer.thumbnailUrl ?? coverUrl
  const { retryKey, handleError } = useImageRetry(src, mediaRefreshToken, () => {
    if (isLocalMediaUrl(src)) onLocalMediaMissing?.()
  })
  return <SlideThumbnail key={retryKey} src={src} alt={title} onError={handleError} />
}

function RetryableGalleryImage({
  url,
  title,
  mediaRefreshToken,
  onClick,
  onLocalMediaMissing
}: {
  url: string
  title: string
  mediaRefreshToken: number
  onClick: () => void
  onLocalMediaMissing?: () => void
}) {
  const { retryKey, handleError } = useImageRetry(url, mediaRefreshToken, () => {
    if (isLocalMediaUrl(url)) onLocalMediaMissing?.()
  })
  return (
    <SlideThumbnail
      key={retryKey}
      src={url}
      alt={title}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onError={handleError}
    />
  )
}

function RetryableLightboxImage({
  url,
  title,
  mediaRefreshToken,
  onLocalMediaMissing
}: {
  url: string
  title: string
  mediaRefreshToken: number
  onLocalMediaMissing?: () => void
}) {
  const { retryKey, handleError } = useImageRetry(url, mediaRefreshToken, () => {
    if (isLocalMediaUrl(url)) onLocalMediaMissing?.()
  })
  return <LightboxImage key={retryKey} src={url} alt={title} onError={handleError} />
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
  /** Incrementado pela página sempre que um "Buscar metadados da Steam" (manual ou automático) resolve
   * com sucesso — força um remount de todas as mídias mesmo quando a URL local não muda (o cache local usa
   * o hash da URL remota, então uma re-busca sem mudança na Steam gera exatamente a mesma URL local). */
  mediaRefreshToken?: number
  /** Chamado quando uma imagem/vídeo local (baixado antes, sumido da pasta de mídia) não carrega — a
   * página que usa este componente decide o que fazer (ex: forçar "Buscar metadados da Steam" de novo). */
  onLocalMediaMissing?: () => void
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
  screenshots,
  mediaRefreshToken = 0,
  onLocalMediaMissing
}: GameHeroProps) {
  const showPublishers = publishers.length > 0 && publishers.join(',') !== developers.join(',')
  const galleryImages = coverUrl ? [coverUrl, ...screenshots.filter((url) => url !== coverUrl)] : screenshots

  const mediaItems: MediaItem[] = [
    ...trailers.map((trailer): MediaItem => ({ type: 'video', trailer })),
    ...galleryImages.map((url): MediaItem => ({ type: 'image', url }))
  ]
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const activeMedia = activeMediaIndex !== null ? mediaItems[activeMediaIndex] : null

  const openTrailer = (trailer: GameTrailer): void => {
    setActiveMediaIndex(mediaItems.findIndex((item) => item.type === 'video' && item.trailer === trailer))
  }
  const openImage = (url: string): void => {
    setActiveMediaIndex(mediaItems.findIndex((item) => item.type === 'image' && item.url === url))
  }

  useEffect(() => {
    if (activeMediaIndex === null) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        setActiveMediaIndex((current) => (current !== null && current > 0 ? current - 1 : current))
      } else if (event.key === 'ArrowRight') {
        setActiveMediaIndex((current) =>
          current !== null && current < mediaItems.length - 1 ? current + 1 : current
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMediaIndex, mediaItems.length])

  return (
    <>
      <PageTitle level={2}>{title}</PageTitle>

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
                    <RetryableTrailerThumbnail
                      trailer={trailer}
                      coverUrl={coverUrl}
                      title={title}
                      mediaRefreshToken={mediaRefreshToken}
                      onLocalMediaMissing={onLocalMediaMissing}
                    />
                    <SlidePlayOverlay onClick={() => openTrailer(trailer)}>
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
              <SimpleCarousel
                items={galleryImages}
                keyOf={(url) => url}
                renderItem={(url) => (
                  <RetryableGalleryImage
                    url={url}
                    title={title}
                    mediaRefreshToken={mediaRefreshToken}
                    onClick={() => openImage(url)}
                    onLocalMediaMissing={onLocalMediaMissing}
                  />
                )}
                {...(trailers.length === 0
                  ? { smallItemsPerView: 2, largeItemsPerView: 4, breakpointWidth: 900 }
                  : {})}
              />
            </div>
          )}
        </GalleryColumns>
      )}

      <Modal
        open={activeMedia !== null}
        onCancel={() => setActiveMediaIndex(null)}
        footer={null}
        width={900}
        destroyOnClose
        centered
        closable={false}
        styles={{ content: { padding: 0, background: 'transparent', boxShadow: 'none' } }}
      >
        {activeMedia && activeMediaIndex !== null && (
          <LightboxWrapper>
            {activeMedia.type === 'video' ? (
              <LightboxVideo
                key={`${activeMedia.trailer.url}-${mediaRefreshToken}`}
                src={activeMedia.trailer.url}
                poster={activeMedia.trailer.thumbnailUrl ?? coverUrl}
                autoPlay
                onError={() => {
                  if (isLocalMediaUrl(activeMedia.trailer.url)) onLocalMediaMissing?.()
                }}
              />
            ) : (
              <RetryableLightboxImage
                url={activeMedia.url}
                title={title}
                mediaRefreshToken={mediaRefreshToken}
                onLocalMediaMissing={onLocalMediaMissing}
              />
            )}

            {mediaItems.length > 1 && (
              <>
                <LightboxArrow
                  type="button"
                  $side="left"
                  aria-label="Mídia anterior"
                  disabled={activeMediaIndex === 0}
                  onClick={() => setActiveMediaIndex(activeMediaIndex - 1)}
                >
                  <CaretLeftFilled />
                </LightboxArrow>
                <LightboxArrow
                  type="button"
                  $side="right"
                  aria-label="Próxima mídia"
                  disabled={activeMediaIndex === mediaItems.length - 1}
                  onClick={() => setActiveMediaIndex(activeMediaIndex + 1)}
                >
                  <CaretRightFilled />
                </LightboxArrow>
              </>
            )}
          </LightboxWrapper>
        )}
      </Modal>
    </>
  )
}
