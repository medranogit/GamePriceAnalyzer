import { app } from 'electron'

/**
 * Usa a API nativa do Electron (sem dependência extra) para registrar o app
 * como item de login do Windows, iniciando minimizado na bandeja.
 */
export class AutoLaunchService {
  setEnabled(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--hidden']
    })
  }

  isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin
  }
}
