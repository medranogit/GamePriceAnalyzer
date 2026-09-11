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
import { SteamSearchRepositoryImpl } from './infrastructure/steam/SteamSearchRepositoryImpl'
import { SteamWishlistRepositoryImpl } from './infrastructure/steam/SteamWishlistRepositoryImpl'
import { GGDealsApiClient } from './infrastructure/ggdeals/GGDealsApiClient'
import { DealsRepositoryImpl } from './infrastructure/ggdeals/DealsRepositoryImpl'
import { ElectronNotificationService } from './infrastructure/notifications/ElectronNotificationService'
import { PollingScheduler } from './infrastructure/scheduler/PollingScheduler'
import { TrayController } from './infrastructure/tray/TrayController'
import { AutoLaunchService } from './infrastructure/autostart/AutoLaunchService'
import { JsonPriceHistoryRepository } from './infrastructure/storage/JsonPriceHistoryRepository'
import { JsonHistoryRepository } from './infrastructure/storage/JsonHistoryRepository'
import { SyncSteamLibrary } from './domain/use-cases/SyncSteamLibrary'
import { AddWishlistItem } from './domain/use-cases/AddWishlistItem'
import { RemoveWishlistItem } from './domain/use-cases/RemoveWishlistItem'
import { RefreshWishlistPrices } from './domain/use-cases/RefreshWishlistPrices'
import { SyncSteamWishlist } from './domain/use-cases/SyncSteamWishlist'
import { FetchOwnableDeals } from './domain/use-cases/FetchOwnableDeals'
import { CheckDealAlerts } from './domain/use-cases/CheckDealAlerts'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'

const startedHidden = process.argv.includes('--hidden')
let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Necessário no Windows pra notificações mostrarem o nome/ícone certo do app.
app.setAppUserModelId('com.gamepriceanalyzer.app')

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
    title: `GamePriceAnalyzer v${app.getVersion()}`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Sem isso, o <title> do index.html sobrescreveria o título (com versão) assim que a
  // página carrega.
  window.on('page-title-updated', (event) => {
    event.preventDefault()
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
  const metadataRepository = new SteamStoreMetadataRepositoryImpl()
  const steamSearchRepository = new SteamSearchRepositoryImpl()
  const steamWishlistRepository = new SteamWishlistRepositoryImpl()
  const priceHistoryRepository = new JsonPriceHistoryRepository()

  const ggDealsClient = new GGDealsApiClient(() => secretsStore.get('ggDealsApiKey'))
  const dealsRepository = new DealsRepositoryImpl(ggDealsClient)

  const syncSteamLibrary = new SyncSteamLibrary(steamLibraryRepository, cacheRepository, historyRepository)
  const addWishlistItem = new AddWishlistItem(metadataRepository, cacheRepository, historyRepository)
  const removeWishlistItem = new RemoveWishlistItem(cacheRepository, historyRepository)
  const refreshWishlistPrices = new RefreshWishlistPrices(
    dealsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository
  )
  const syncSteamWishlist = new SyncSteamWishlist(
    steamWishlistRepository,
    metadataRepository,
    cacheRepository,
    historyRepository
  )
  const fetchOwnableDeals = new FetchOwnableDeals(
    dealsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository
  )

  mainWindow = createMainWindow()

  const notificationService = new ElectronNotificationService(() => mainWindow, settingsRepository)
  const checkDealAlerts = new CheckDealAlerts(
    fetchOwnableDeals,
    notifiedDealsRepository,
    notificationService,
    historyRepository,
    settingsRepository
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

  // Mantém a wishlist sempre atualizada sozinha — uma vez ao abrir, e depois 1x por dia.
  // Sem necessidade de reimportar o JSON manualmente.
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const syncWishlistIfConfigured = async (): Promise<void> => {
    const steamId64 = settingsRepository.get().steamId64
    if (!steamId64) return
    try {
      await syncSteamWishlist.execute(steamId64)
    } catch (error) {
      logger.error('Falha ao sincronizar wishlist com a Steam', error)
    }
  }
  void syncWishlistIfConfigured()
  setInterval(() => void syncWishlistIfConfigured(), ONE_DAY_MS)

  registerIpcHandlers({
    settingsRepository,
    cacheRepository,
    historyRepository,
    syncSteamLibrary,
    addWishlistItem,
    removeWishlistItem,
    refreshWishlistPrices,
    syncSteamWishlist,
    steamSearchRepository,
    scheduler,
    secretsStore,
    autoLaunchService,
    notificationService
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
