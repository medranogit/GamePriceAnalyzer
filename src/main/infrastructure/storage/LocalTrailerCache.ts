import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fetchWithRetry } from '../http/fetchWithRetry'
import { logger } from '../logging/logger'
import { extractM3u8References } from '../steam/hlsManifest'
import { getGameTrailersDir } from './localMediaPaths'

export const VIDEO_PROTOCOL_SCHEME = 'app-video'

const MIRROR_CONCURRENCY = 8
/** Marca que o espelhamento terminou com sucesso — sem isso, uma segunda chamada enquanto a primeira
 * ainda está baixando segmentos acharia o manifest master (escrito logo no início) e devolveria a URL
 * local achando que já tá tudo pronto, quando na verdade só uma parte foi baixada. */
const COMPLETE_MARKER_FILE = '.complete'

function isM3u8Url(url: string): boolean {
  return url.split('?')[0].endsWith('.m3u8')
}

/** Caminho relativo de `url` em relação ao diretório do manifest raiz (`baseUrl`), sem query string —
 * é esse caminho que espelhamos no disco local, preservando a estrutura de pastas original da Steam. */
function relativePathOf(url: string, baseUrl: string): string {
  const baseDir = new URL('.', baseUrl).toString()
  return decodeURIComponent(url.replace(baseDir, '').split('?')[0])
}

/** Roda `fn` pra cada item de `items`, no máximo `concurrency` de cada vez — evita tanto baixar tudo em
 * série (lento pra dezenas de segmentos) quanto disparar todos os requests de uma vez (arriscado). */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
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

    const alreadyCached = await access(join(destDir, COMPLETE_MARKER_FILE))
      .then(() => true)
      .catch(() => false)
    if (alreadyCached) return localUrl

    try {
      await this.mirror(masterUrl, destDir)
      await writeFile(join(destDir, COMPLETE_MARKER_FILE), '')
      return localUrl
    } catch (error) {
      logger.warn(`Falha ao baixar trailer local: ${masterUrl}`, error)
      return masterUrl
    }
  }

  private async fetchAndStore(currentUrl: string, masterUrl: string, destDir: string): Promise<string[]> {
    const res = await fetchWithRetry(currentUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status} baixando ${currentUrl}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const localPath = join(destDir, relativePathOf(currentUrl, masterUrl))
    await mkdir(dirname(localPath), { recursive: true })
    await writeFile(localPath, buffer)

    if (!isM3u8Url(currentUrl)) return []
    return extractM3u8References(buffer.toString('utf-8')).map((ref) => new URL(ref, currentUrl).toString())
  }

  /**
   * A estrutura HLS da Steam tem sempre 2 níveis: o manifest master referencia as variantes de
   * áudio/vídeo, e cada variante referencia seus segmentos — por isso baixa em duas rodadas (variantes,
   * depois todos os segmentos de todas elas juntos), cada rodada em paralelo (até MIRROR_CONCURRENCY por
   * vez), bem mais rápido que baixar um arquivo de cada vez.
   */
  private async mirror(masterUrl: string, destDir: string): Promise<void> {
    const variantUrls = await this.fetchAndStore(masterUrl, masterUrl, destDir)

    const segmentUrlLists = await mapWithConcurrency(variantUrls, MIRROR_CONCURRENCY, (url) =>
      this.fetchAndStore(url, masterUrl, destDir)
    )
    const segmentUrls = segmentUrlLists.flat()

    await mapWithConcurrency(segmentUrls, MIRROR_CONCURRENCY, (url) =>
      this.fetchAndStore(url, masterUrl, destDir)
    )
  }
}
