import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { VIDEO_PROTOCOL_SCHEME } from '../storage/LocalTrailerCache'

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
  protocol.handle(VIDEO_PROTOCOL_SCHEME, (request) => {
    const url = new URL(request.url)
    const filePath = join(cacheDir, decodeURIComponent(url.pathname))
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
