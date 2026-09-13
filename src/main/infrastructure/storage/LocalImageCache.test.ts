import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const REMOTE_URL = 'https://steamstatic.example.com/cover.jpg'
const IMAGE_BYTES = 'fake-image-bytes'

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
  if (url !== REMOTE_URL) return { ok: false, status: 404 }
  return { ok: true, arrayBuffer: async () => Buffer.from(IMAGE_BYTES) }
})
vi.mock('../http/fetchWithRetry', () => ({ fetchWithRetry: fetchMock }))

const { LocalImageCache, IMAGE_PROTOCOL_SCHEME } = await import('./LocalImageCache')
const { logger } = await import('../logging/logger')

function expectedHash(): string {
  return createHash('sha1').update(REMOTE_URL).digest('hex')
}

describe('LocalImageCache', () => {
  it('baixa a imagem e devolve uma URL local organizada pelo AppID', async () => {
    accessShouldSucceed = false
    writtenFiles.clear()
    fetchMock.mockClear()
    const cache = new LocalImageCache()

    const result = await cache.cacheImage(REMOTE_URL, 346110)

    const hash = expectedHash()
    expect(result).toBe(`${IMAGE_PROTOCOL_SCHEME}://cache/346110/images/${hash}.jpg`)
    expect(fetchMock).toHaveBeenCalledWith(REMOTE_URL)
    const written = [...writtenFiles.entries()].find(([path]) => path.includes(`${hash}.jpg`))
    expect(written?.[1]).toBe(IMAGE_BYTES)
  })

  it('não baixa de novo se o arquivo já estiver em cache', async () => {
    accessShouldSucceed = true
    fetchMock.mockClear()
    const cache = new LocalImageCache()

    await cache.cacheImage(REMOTE_URL, 346110)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('devolve a URL remota original se o download falhar', async () => {
    accessShouldSucceed = false
    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as never)
    const cache = new LocalImageCache()

    const result = await cache.cacheImage(REMOTE_URL, 346110)

    expect(result).toBe(REMOTE_URL)
    expect(logger.warn).toHaveBeenCalled()
  })
})
