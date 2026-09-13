import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { IMAGE_PROTOCOL_SCHEME } from '../storage/LocalImageCache'
import { logger } from '../logging/logger'

/** Precisa ser chamado antes de `app.whenReady()` — a Electron não deixa registrar privilégios de um
 * scheme customizado depois que o app já está pronto. */
export function registerImageProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_PROTOCOL_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ])
}

/** Serve os arquivos baixados por `LocalImageCache` pro renderer, via `app-image://cache/<arquivo>`. */
export function handleImageProtocol(cacheDir: string): void {
  protocol.handle(IMAGE_PROTOCOL_SCHEME, async (request) => {
    const url = new URL(request.url)
    const filePath = join(cacheDir, decodeURIComponent(url.pathname))

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString())
      if (!response.ok) {
        logger.warn(`app-image: HTTP ${response.status} servindo ${filePath} (pedido: ${request.url})`)
      }
      return response
    } catch (error) {
      logger.warn(`app-image: falha ao servir ${filePath} (pedido: ${request.url})`, error)
      return new Response(null, { status: 404 })
    }
  })
}
