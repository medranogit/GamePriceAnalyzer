import { join } from 'node:path'
import { app } from 'electron'

const ROOT_DIR_NAME = 'local-media-cache'

/** Diretório raiz compartilhado por LocalImageCache e LocalTrailerCache, organizado por AppID — assim dá
 * pra apontar um botão "abrir pasta" direto pra mídia de um jogo específico, em vez de uma pasta genérica
 * com todos os jogos misturados. */
export function getLocalMediaRootDir(): string {
  return join(app.getPath('userData'), ROOT_DIR_NAME)
}

export function getGameMediaDir(appId: number): string {
  return join(getLocalMediaRootDir(), String(appId))
}

export function getGameImagesDir(appId: number): string {
  return join(getGameMediaDir(appId), 'images')
}

export function getGameTrailersDir(appId: number): string {
  return join(getGameMediaDir(appId), 'trailers')
}
