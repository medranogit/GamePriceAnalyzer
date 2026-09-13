import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { VIDEO_PROTOCOL_SCHEME } from '../storage/LocalTrailerCache'
import { logger } from '../logging/logger'

/** Precisa ser chamado antes de `app.whenReady()` — a Electron não deixa registrar privilégios de um
 * scheme customizado depois que o app já está pronto. */
export function registerVideoProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: VIDEO_PROTOCOL_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ])
}

/** Serve os arquivos baixados por `LocalTrailerCache` pro renderer, via
 * `app-video://trailers/<hash>/<arquivo>` — inclui o manifest e todos os arquivos que ele referencia
 * (áudio, variantes de vídeo, segmentos), preservando os caminhos relativos entre eles. */
export function handleVideoProtocol(cacheDir: string): void {
  protocol.handle(VIDEO_PROTOCOL_SCHEME, async (request) => {
    const url = new URL(request.url)
    const filePath = join(cacheDir, decodeURIComponent(url.pathname))

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString())
      if (!response.ok) {
        logger.warn(`app-video: HTTP ${response.status} servindo ${filePath} (pedido: ${request.url})`)
      }
      return response
    } catch (error) {
      logger.warn(`app-video: falha ao servir ${filePath} (pedido: ${request.url})`, error)
      return new Response(null, { status: 404 })
    }
  })
}
