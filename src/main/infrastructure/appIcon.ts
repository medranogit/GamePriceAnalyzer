import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

/** Ícone do app (janela, notificação de fallback) — mesma resolução dev/produção usada pela bandeja. */
export function getAppIconPath(): string {
  return is.dev ? join(__dirname, '../../resources/icon.png') : join(process.resourcesPath, 'icon.png')
}
