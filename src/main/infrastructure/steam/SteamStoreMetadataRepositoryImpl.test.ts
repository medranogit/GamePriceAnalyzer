import { describe, expect, it, vi } from 'vitest'

vi.mock('../http/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn()
}))

vi.mock('../logging/logger', () => ({
  logger: { warn: vi.fn() }
}))

const { fetchWithRetry } = await import('../http/fetchWithRetry')
const { SteamStoreMetadataRepositoryImpl } = await import('./SteamStoreMetadataRepositoryImpl')

function makeResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

describe('SteamStoreMetadataRepositoryImpl', () => {
  it('resolve metadata normalmente quando o jogo não tem nenhum vídeo', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({ '730': { success: true, data: { name: 'CS2', genres: [] } } })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(730)

    expect(result?.title).toBe('CS2')
    expect(result?.trailers).toEqual([])
  })

  it('usa o manifest HLS quando o vídeo não tem mp4 (caso atual da Steam, que parou de devolver mp4 pra maioria dos jogos)', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({
        '346110': {
          success: true,
          data: {
            name: 'ARK: Survival Evolved',
            genres: [],
            movies: [
              {
                id: 1,
                highlight: true,
                thumbnail: 'https://example.com/thumb.jpg',
                hls_h264: 'https://video.example.com/trailer.m3u8'
              }
            ]
          }
        }
      })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(346110)

    expect(result?.trailers).toEqual([
      { url: 'https://video.example.com/trailer.m3u8', thumbnailUrl: 'https://example.com/thumb.jpg' }
    ])
  })

  it('não quebra (e ignora o vídeo) quando ele só tem webm, sem mp4 nem hls — regressão real do appdetails', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({
        '2280': {
          success: true,
          data: {
            name: 'Jogo antigo',
            genres: [],
            movies: [{ id: 1, highlight: true, webm: { '480': 'x.webm' } }]
          }
        }
      })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(2280)

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Jogo antigo')
    expect(result?.trailers).toEqual([])
  })

  it('extrai TODOS os trailers do jogo, não só o "highlight" — jogos maiores têm vários (lançamento, DLCs, updates)', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({
        '1': {
          success: true,
          data: {
            name: 'Jogo com vários trailers',
            genres: [],
            movies: [
              {
                id: 1,
                highlight: true,
                thumbnail: 'thumb1.jpg',
                mp4: { '480': 'low1.mp4', max: 'max1.mp4' }
              },
              { id: 2, highlight: true, thumbnail: 'thumb2.jpg', mp4: { '480': 'low2.mp4' } },
              { id: 3, highlight: false, webm: { '480': 'x.webm' } }
            ]
          }
        }
      })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(1)

    expect(result?.trailers).toEqual([
      { url: 'max1.mp4', thumbnailUrl: 'thumb1.jpg' },
      { url: 'low2.mp4', thumbnailUrl: 'thumb2.jpg' }
    ])
  })

  it('extrai a lista de AppIDs de DLC de um jogo base', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({
        '1091500': { success: true, data: { name: 'Cyberpunk 2077', genres: [], dlc: [1424700, 2181640] } }
      })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(1091500)

    expect(result?.dlcAppIds).toEqual([1424700, 2181640])
    expect(result?.isDlc).toBe(false)
    expect(result?.parentAppId).toBeNull()
  })

  it('identifica quando o próprio AppID buscado é uma DLC, e de qual jogo base', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(
      makeResponse({
        '1424700': {
          success: true,
          data: {
            name: 'Cyberpunk 2077: Phantom Liberty',
            genres: [],
            type: 'dlc',
            fullgame: { appid: '1091500', name: 'Cyberpunk 2077' }
          }
        }
      })
    )
    const repository = new SteamStoreMetadataRepositoryImpl()

    const result = await repository.fetchMetadata(1424700)

    expect(result?.isDlc).toBe(true)
    expect(result?.parentAppId).toBe(1091500)
    expect(result?.dlcAppIds).toEqual([])
  })
})
