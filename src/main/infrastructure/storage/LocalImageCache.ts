import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fetchWithRetry } from '../http/fetchWithRetry'
import { logger } from '../logging/logger'
import { getGameImagesDir } from './localMediaPaths'

export const IMAGE_PROTOCOL_SCHEME = 'app-image'

export class LocalImageCache {
  /**
   * Baixa a imagem pra disco (se ainda não tiver uma cópia) e devolve uma URL local `app-image://` pra
   * usar no lugar da remota. O nome do arquivo é um hash da URL original, então uma nova chamada com a
   * mesma URL não baixa de novo. Se o download falhar, devolve a própria URL remota (fallback).
   */
  async cacheImage(remoteUrl: string, appId: number): Promise<string> {
    const destDir = getGameImagesDir(appId)
    await mkdir(destDir, { recursive: true })

    const hash = createHash('sha1').update(remoteUrl).digest('hex')
    const ext = extname(new URL(remoteUrl).pathname) || '.jpg'
    const fileName = `${hash}${ext}`
    const filePath = join(destDir, fileName)

    const alreadyCached = await access(filePath)
      .then(() => true)
      .catch(() => false)

    if (!alreadyCached) {
      try {
        const res = await fetchWithRetry(remoteUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = Buffer.from(await res.arrayBuffer())
        await writeFile(filePath, buffer)
      } catch (error) {
        logger.warn(`Falha ao baixar imagem local: ${remoteUrl}`, error)
        return remoteUrl
      }
    }

    return `${IMAGE_PROTOCOL_SCHEME}://cache/${appId}/images/${fileName}`
  }
}
