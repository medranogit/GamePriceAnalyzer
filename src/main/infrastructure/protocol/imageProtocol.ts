import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { IMAGE_PROTOCOL_SCHEME } from '../storage/LocalImageCache'

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
  protocol.handle(IMAGE_PROTOCOL_SCHEME, (request) => {
    const url = new URL(request.url)
    const filePath = join(cacheDir, decodeURIComponent(url.pathname))
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
