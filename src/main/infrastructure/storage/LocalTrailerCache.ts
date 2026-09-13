import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fetchWithRetry } from '../http/fetchWithRetry'
import { logger } from '../logging/logger'
import { extractM3u8References } from '../steam/hlsManifest'
import { getGameTrailersDir } from './localMediaPaths'

export const VIDEO_PROTOCOL_SCHEME = 'app-video'

function isM3u8Url(url: string): boolean {
  return url.split('?')[0].endsWith('.m3u8')
}

/** Caminho relativo de `url` em relação ao diretório do manifest raiz (`baseUrl`), sem query string —
 * é esse caminho que espelhamos no disco local, preservando a estrutura de pastas original da Steam. */
function relativePathOf(url: string, baseUrl: string): string {
  const baseDir = new URL('.', baseUrl).toString()
  return decodeURIComponent(url.replace(baseDir, '').split('?')[0])
}

export class LocalTrailerCache {
  /**
   * Baixa o manifest HLS inteiro (master + variantes de áudio/vídeo + todos os segmentos referenciados),
   * espelhando a mesma estrutura de pastas do CDN da Steam — os caminhos relativos dentro dos manifests
   * continuam batendo, sem precisar reescrever nada. Devolve a URL local `app-video://` do manifest
   * master. Se já tiver sido baixado antes (mesma URL), não baixa de novo. Em qualquer falha, devolve a
   * própria URL remota original (fallback) — nunca deixa o vídeo sem tocar por causa disso.
   */
  async cacheTrailer(masterUrl: string, appId: number): Promise<string> {
    const hash = createHash('sha1').update(masterUrl).digest('hex')
    const destDir = join(getGameTrailersDir(appId), hash)
    const masterRelativePath = relativePathOf(masterUrl, masterUrl)
    const localUrl = `${VIDEO_PROTOCOL_SCHEME}://trailers/${appId}/trailers/${hash}/${masterRelativePath}`

    const alreadyCached = await access(join(destDir, masterRelativePath))
      .then(() => true)
      .catch(() => false)
    if (alreadyCached) return localUrl

    try {
      await this.mirror(masterUrl, destDir)
      return localUrl
    } catch (error) {
      logger.warn(`Falha ao baixar trailer local: ${masterUrl}`, error)
      return masterUrl
    }
  }

  private async mirror(masterUrl: string, destDir: string): Promise<void> {
    const visited = new Set<string>()
    const queue: string[] = [masterUrl]

    while (queue.length > 0) {
      const currentUrl = queue.shift() as string
      if (visited.has(currentUrl)) continue
      visited.add(currentUrl)

      const res = await fetchWithRetry(currentUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status} baixando ${currentUrl}`)
      const buffer = Buffer.from(await res.arrayBuffer())

      const localPath = join(destDir, relativePathOf(currentUrl, masterUrl))
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, buffer)

      if (isM3u8Url(currentUrl)) {
        for (const ref of extractM3u8References(buffer.toString('utf-8'))) {
          const absoluteRef = new URL(ref, currentUrl).toString()
          if (!visited.has(absoluteRef)) queue.push(absoluteRef)
        }
      }
    }
  }
}
