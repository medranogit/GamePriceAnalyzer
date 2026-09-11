import { ipcMain, dialog, type BrowserWindow } from 'electron'
import type { AppSettings } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import type { SettingsRepository } from '../domain/repositories/SettingsRepository'
import type { AppCacheRepository } from '../domain/repositories/AppCacheRepository'
import type { SyncSteamLibrary } from '../domain/use-cases/SyncSteamLibrary'
import type { ImportWishlist } from '../domain/use-cases/ImportWishlist'
import type { FetchOwnableDeals } from '../domain/use-cases/FetchOwnableDeals'
import type { AddWishlistItem } from '../domain/use-cases/AddWishlistItem'
import type { RemoveWishlistItem } from '../domain/use-cases/RemoveWishlistItem'
import type { RefreshWishlistPrices } from '../domain/use-cases/RefreshWishlistPrices'
import type { SteamSearchRepository } from '../domain/repositories/SteamSearchRepository'
import type { PollingScheduler } from '../infrastructure/scheduler/PollingScheduler'
import type { SecretsStore } from '../infrastructure/secrets/SecretsStore'
import type { AutoLaunchService } from '../infrastructure/autostart/AutoLaunchService'

interface Dependencies {
  settingsRepository: SettingsRepository
  cacheRepository: AppCacheRepository
  syncSteamLibrary: SyncSteamLibrary
  importWishlist: ImportWishlist
  addWishlistItem: AddWishlistItem
  removeWishlistItem: RemoveWishlistItem
  refreshWishlistPrices: RefreshWishlistPrices
  steamSearchRepository: SteamSearchRepository
  fetchOwnableDeals: FetchOwnableDeals
  scheduler: PollingScheduler
  secretsStore: SecretsStore
  autoLaunchService: AutoLaunchService
  getMainWindow: () => BrowserWindow | null
}

export function registerIpcHandlers(deps: Dependencies): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => deps.settingsRepository.get())

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, partial: Partial<AppSettings>) => {
    const updated = deps.settingsRepository.update(partial)
    if (partial.polling?.intervalMinutes) {
      deps.scheduler.updateInterval(updated.polling.intervalMinutes)
    }
    if (partial.autoStartOnBoot !== undefined) {
      deps.autoLaunchService.setEnabled(partial.autoStartOnBoot)
    }
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.libraryGetCached, () => deps.cacheRepository.getOwnedGames())

  ipcMain.handle(IPC_CHANNELS.librarySync, async () => {
    const settings = deps.settingsRepository.get()
    if (!settings.steamId64) {
      throw new Error('SteamID64 não configurado. Cadastre em Configurações.')
    }
    return deps.syncSteamLibrary.execute(settings.steamId64)
  })

  ipcMain.handle(IPC_CHANNELS.wishlistGetCached, () => deps.cacheRepository.getWishlist())

  ipcMain.handle(IPC_CHANNELS.wishlistImport, async (_event, filePath?: string) => {
    const settings = deps.settingsRepository.get()
    const path = filePath ?? settings.wishlistFilePath
    if (!path) {
      throw new Error('Nenhum arquivo de wishlist selecionado.')
    }
    if (filePath) {
      deps.settingsRepository.update({ wishlistFilePath: filePath })
    }
    return deps.importWishlist.execute(path)
  })

  ipcMain.handle(IPC_CHANNELS.wishlistAdd, (_event, appId: number) => deps.addWishlistItem.execute(appId))

  ipcMain.handle(IPC_CHANNELS.wishlistRemove, (_event, appId: number) => deps.removeWishlistItem.execute(appId))

  ipcMain.handle(IPC_CHANNELS.wishlistRefreshPrices, () => deps.refreshWishlistPrices.execute())

  ipcMain.handle(IPC_CHANNELS.steamSearchGames, (_event, query: string) => deps.steamSearchRepository.searchGames(query))

  ipcMain.handle(IPC_CHANNELS.dealsGetCached, () => deps.cacheRepository.getDeals())

  ipcMain.handle(IPC_CHANNELS.dealsFetch, () => deps.fetchOwnableDeals.execute())

  ipcMain.handle(IPC_CHANNELS.pollingTriggerNow, () => deps.scheduler.runNow())

  ipcMain.handle(IPC_CHANNELS.pickWishlistFile, async () => {
    const window = deps.getMainWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      title: 'Selecionar wishlist.json exportado',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.secretsStatus, () => ({
    hasSteamApiKey: Boolean(deps.secretsStore.get('steamApiKey')),
    hasGGDealsApiKey: Boolean(deps.secretsStore.get('ggDealsApiKey'))
  }))

  ipcMain.handle(IPC_CHANNELS.secretsSetSteamApiKey, (_event, value: string) => {
    deps.secretsStore.set('steamApiKey', value)
  })

  ipcMain.handle(IPC_CHANNELS.secretsSetGGDealsApiKey, (_event, value: string) => {
    deps.secretsStore.set('ggDealsApiKey', value)
  })
}
