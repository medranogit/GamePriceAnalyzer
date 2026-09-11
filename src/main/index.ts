import 'dotenv/config'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { logger } from './infrastructure/logging/logger'
import { getAppIconPath } from './infrastructure/appIcon'
import { SecretsStore } from './infrastructure/secrets/SecretsStore'
import { ElectronStoreSettingsRepository } from './infrastructure/storage/ElectronStoreSettingsRepository'
import { ElectronStoreAppCacheRepository } from './infrastructure/storage/ElectronStoreAppCacheRepository'
import { ElectronStoreNotifiedDealsRepository } from './infrastructure/storage/ElectronStoreNotifiedDealsRepository'
import { SteamWebApiClient } from './infrastructure/steam/SteamWebApiClient'
import { SteamLibraryRepositoryImpl } from './infrastructure/steam/SteamLibraryRepositoryImpl'
import { SteamStoreMetadataRepositoryImpl } from './infrastructure/steam/SteamStoreMetadataRepositoryImpl'
import { SteamSpecialsRepositoryImpl } from './infrastructure/steam/SteamSpecialsRepositoryImpl'
import { SteamSearchRepositoryImpl } from './infrastructure/steam/SteamSearchRepositoryImpl'
import { WishlistJsonRepositoryImpl } from './infrastructure/wishlist/WishlistJsonRepositoryImpl'
import { GGDealsApiClient } from './infrastructure/ggdeals/GGDealsApiClient'
import { DealsRepositoryImpl } from './infrastructure/ggdeals/DealsRepositoryImpl'
import { ElectronNotificationService } from './infrastructure/notifications/ElectronNotificationService'
import { PollingScheduler } from './infrastructure/scheduler/PollingScheduler'
import { TrayController } from './infrastructure/tray/TrayController'
import { AutoLaunchService } from './infrastructure/autostart/AutoLaunchService'
import { JsonPriceHistoryRepository } from './infrastructure/storage/JsonPriceHistoryRepository'
import { JsonHistoryRepository } from './infrastructure/storage/JsonHistoryRepository'
import { SyncSteamLibrary } from './domain/use-cases/SyncSteamLibrary'
import { ImportWishlist } from './domain/use-cases/ImportWishlist'
import { AddWishlistItem } from './domain/use-cases/AddWishlistItem'
import { RemoveWishlistItem } from './domain/use-cases/RemoveWishlistItem'
import { RefreshWishlistPrices } from './domain/use-cases/RefreshWishlistPrices'
import { FetchOwnableDeals } from './domain/use-cases/FetchOwnableDeals'
import { CheckDealAlerts } from './domain/use-cases/CheckDealAlerts'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'

const startedHidden = process.argv.includes('--hidden')
let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Necessário no Windows pra notificações mostrarem o nome/ícone certo do app.
app.setAppUserModelId('com.apphub360.gamepriceanalyzer')

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(bootstrap)
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    if (!startedHidden) window.show()
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(`Falha ao carregar renderer: ${errorCode} ${errorDescription} (${validatedURL})`)
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Render process encerrado inesperadamente', details)
  })

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

async function bootstrap(): Promise<void> {
  app.on('before-quit', () => {
    isQuitting = true
  })

  const secretsStore = new SecretsStore()
  const settingsRepository = new ElectronStoreSettingsRepository()
  const cacheRepository = new ElectronStoreAppCacheRepository()
  const notifiedDealsRepository = new ElectronStoreNotifiedDealsRepository()
  const historyRepository = new JsonHistoryRepository()
  const autoLaunchService = new AutoLaunchService()

  const steamClient = new SteamWebApiClient(() => secretsStore.get('steamApiKey'))
  const steamLibraryRepository = new SteamLibraryRepositoryImpl(steamClient)
  const wishlistRepository = new WishlistJsonRepositoryImpl()
  const metadataRepository = new SteamStoreMetadataRepositoryImpl()
  const steamSpecialsRepository = new SteamSpecialsRepositoryImpl()
  const steamSearchRepository = new SteamSearchRepositoryImpl()
  const priceHistoryRepository = new JsonPriceHistoryRepository()

  const ggDealsClient = new GGDealsApiClient(() => secretsStore.get('ggDealsApiKey'))
  const dealsRepository = new DealsRepositoryImpl(ggDealsClient)

  const syncSteamLibrary = new SyncSteamLibrary(steamLibraryRepository, cacheRepository, historyRepository)
  const importWishlist = new ImportWishlist(wishlistRepository, cacheRepository, historyRepository)
  const addWishlistItem = new AddWishlistItem(metadataRepository, cacheRepository, historyRepository)
  const removeWishlistItem = new RemoveWishlistItem(cacheRepository, historyRepository)
  const refreshWishlistPrices = new RefreshWishlistPrices(
    dealsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository
  )
  const fetchOwnableDeals = new FetchOwnableDeals(
    dealsRepository,
    steamSpecialsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository,
    settingsRepository
  )

  mainWindow = createMainWindow()

  const notificationService = new ElectronNotificationService(() => mainWindow, settingsRepository)
  const checkDealAlerts = new CheckDealAlerts(
    fetchOwnableDeals,
    notifiedDealsRepository,
    notificationService,
    historyRepository
  )

  const scheduler = new PollingScheduler(async () => {
    await checkDealAlerts.execute()
  })
  scheduler.start(settingsRepository.get().polling.intervalMinutes)

  const trayController = new TrayController(
    () => mainWindow,
    () => scheduler.runNow()
  )
  trayController.create()

  autoLaunchService.setEnabled(settingsRepository.get().autoStartOnBoot)

  registerIpcHandlers({
    settingsRepository,
    cacheRepository,
    historyRepository,
    syncSteamLibrary,
    importWishlist,
    addWishlistItem,
    removeWishlistItem,
    refreshWishlistPrices,
    steamSearchRepository,
    fetchOwnableDeals,
    scheduler,
    secretsStore,
    autoLaunchService,
    getMainWindow: () => mainWindow
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })

  // O app deve continuar rodando em background (bandeja) mesmo sem janela visível.
  app.on('window-all-closed', () => {
    /* no-op de propósito */
  })

  logger.info('GamePriceAnalyzer iniciado.')
}
