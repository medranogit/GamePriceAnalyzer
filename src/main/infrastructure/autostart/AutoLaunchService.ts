import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { logger } from '../logging/logger'

/**
 * Usa a API nativa do Electron (sem dependência extra) para registrar o app
 * como item de login do Windows, iniciando minimizado na bandeja.
 */
export class AutoLaunchService {
  setEnabled(enabled: boolean): void {
    if (is.dev) {
      // Em dev, process.execPath aponta pro electron.exe dentro de node_modules — registrar
      // isso como item de login faria o Windows abrir a tela padrão do Electron (sem saber
      // qual app carregar) em vez do HubGame Center de verdade. Só o build empacotado deve
      // mexer nesse registro.
      logger.info('Ignorando alteração do item de login: rodando em modo dev.')
      return
    }
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--hidden']
    })
  }

  isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin
  }
}
