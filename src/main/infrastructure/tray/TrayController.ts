import { Tray, Menu, nativeImage, type BrowserWindow, app } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

export class TrayController {
  private tray: Tray | null = null

  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly onCheckNow: () => void
  ) {}

  create(): void {
    const iconPath = is.dev
      ? join(__dirname, '../../resources/tray-icon.png')
      : join(process.resourcesPath, 'tray-icon.png')

    this.tray = new Tray(nativeImage.createFromPath(iconPath))
    this.tray.setToolTip('GamePriceAnalyzer')
    this.tray.setContextMenu(this.buildMenu())
    this.tray.on('click', () => this.toggleWindow())
  }

  private buildMenu(): Menu {
    return Menu.buildFromTemplate([
      { label: 'Abrir', click: () => this.showWindow() },
      { label: 'Verificar ofertas agora', click: () => this.onCheckNow() },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() }
    ])
  }

  private toggleWindow(): void {
    const window = this.getMainWindow()
    if (!window) return
    if (window.isVisible()) {
      window.hide()
    } else {
      this.showWindow()
    }
  }

  private showWindow(): void {
    const window = this.getMainWindow()
    if (!window) return
    window.show()
    window.focus()
  }
}
