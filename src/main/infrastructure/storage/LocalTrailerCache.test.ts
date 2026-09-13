import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const MASTER_URL = 'https://cdn.example.com/t/abc/hls_264_master.m3u8?t=1'
const BASE = 'https://cdn.example.com/t/abc/'

const MASTER_MANIFEST = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Default",AUTOSELECT=YES,DEFAULT=YES,URI="hls_264_4_audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1000000,AUDIO="audio"
hls_264_3_video.m3u8`

const AUDIO_MANIFEST = `#EXTM3U
#EXT-X-MAP:URI="dash_h264/init-audio.m4s"
#EXTINF:3
dash_h264/chunk-audio-00001.m4s
#EXT-X-ENDLIST`

const VIDEO_MANIFEST = `#EXTM3U
#EXT-X-MAP:URI="dash_h264/init-video.m4s"
#EXTINF:3
dash_h264/chunk-video-00001.m4s
#EXT-X-ENDLIST`

const FILES: Record<string, string> = {
  [MASTER_URL]: MASTER_MANIFEST,
  [`${BASE}hls_264_4_audio.m3u8`]: AUDIO_MANIFEST,
  [`${BASE}hls_264_3_video.m3u8`]: VIDEO_MANIFEST,
  [`${BASE}dash_h264/init-audio.m4s`]: 'init-audio-bytes',
  [`${BASE}dash_h264/chunk-audio-00001.m4s`]: 'chunk-audio-bytes',
  [`${BASE}dash_h264/init-video.m4s`]: 'init-video-bytes',
  [`${BASE}dash_h264/chunk-video-00001.m4s`]: 'chunk-video-bytes'
}

const writtenFiles = new Map<string, string>()
let accessShouldSucceed = false

vi.mock('electron', () => ({ app: { getPath: () => '/fake/userData' } }))

vi.mock('node:fs/promises', () => ({
  access: vi.fn(() => (accessShouldSucceed ? Promise.resolve() : Promise.reject(new Error('ENOENT')))),
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async (path: string, buffer: Buffer) => {
    writtenFiles.set(path, buffer.toString('utf-8'))
  })
}))

vi.mock('../logging/logger', () => ({ logger: { warn: vi.fn() } }))

const fetchMock = vi.fn(async (url: string) => {
  const body = FILES[url]
  if (body === undefined) return { ok: false, status: 404 }
  return { ok: true, arrayBuffer: async () => Buffer.from(body) }
})
vi.mock('../http/fetchWithRetry', () => ({ fetchWithRetry: fetchMock }))

const { LocalTrailerCache, VIDEO_PROTOCOL_SCHEME } = await import('./LocalTrailerCache')
const { logger } = await import('../logging/logger')
const { getGameTrailersDir } = await import('./localMediaPaths')

const APP_ID = 123

function expectedHash(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

describe('LocalTrailerCache', () => {
  it('espelha o manifest master, as duas variantes e todos os segmentos referenciados, organizado por AppID', async () => {
    accessShouldSucceed = false
    writtenFiles.clear()
    fetchMock.mockClear()
    const cache = new LocalTrailerCache()

    const result = await cache.cacheTrailer(MASTER_URL, APP_ID)

    const hash = expectedHash(MASTER_URL)
    expect(result).toBe(`${VIDEO_PROTOCOL_SCHEME}://trailers/${APP_ID}/trailers/${hash}/hls_264_master.m3u8`)
    expect(fetchMock).toHaveBeenCalledTimes(7)

    const trailersDir = getGameTrailersDir(APP_ID)
    const relativePaths = [...writtenFiles.keys()].map((path) =>
      path.replace(trailersDir, '').replace(/\\/g, '/')
    )
    expect(relativePaths).toEqual(
      expect.arrayContaining([
        `/${hash}/hls_264_master.m3u8`,
        `/${hash}/hls_264_4_audio.m3u8`,
        `/${hash}/hls_264_3_video.m3u8`,
        `/${hash}/dash_h264/init-audio.m4s`,
        `/${hash}/dash_h264/chunk-audio-00001.m4s`,
        `/${hash}/dash_h264/init-video.m4s`,
        `/${hash}/dash_h264/chunk-video-00001.m4s`
      ])
    )
  })

  it('não baixa de novo se o manifest master já estiver em cache', async () => {
    accessShouldSucceed = true
    fetchMock.mockClear()
    const cache = new LocalTrailerCache()

    const result = await cache.cacheTrailer(MASTER_URL, APP_ID)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toContain(VIDEO_PROTOCOL_SCHEME)
  })

  it('devolve a URL remota original se algum arquivo falhar no meio do caminho', async () => {
    accessShouldSucceed = false
    writtenFiles.clear()
    fetchMock.mockClear()
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }))
    const cache = new LocalTrailerCache()

    const result = await cache.cacheTrailer(MASTER_URL, APP_ID)

    expect(result).toBe(MASTER_URL)
    expect(logger.warn).toHaveBeenCalled()
  })
})
