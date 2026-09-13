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
import { ThrottledGameMetadataRepository } from './infrastructure/steam/ThrottledGameMetadataRepository'
import { LocalImageCachingGameMetadataRepository } from './infrastructure/steam/LocalImageCachingGameMetadataRepository'
import { LocalTrailerCachingGameMetadataRepository } from './infrastructure/steam/LocalTrailerCachingGameMetadataRepository'
import { LocalImageCache } from './infrastructure/storage/LocalImageCache'
import { LocalTrailerCache } from './infrastructure/storage/LocalTrailerCache'
import { getLocalMediaRootDir } from './infrastructure/storage/localMediaPaths'
import { registerImageProtocolPrivileges, handleImageProtocol } from './infrastructure/protocol/imageProtocol'
import { registerVideoProtocolPrivileges, handleVideoProtocol } from './infrastructure/protocol/videoProtocol'
import { SteamSearchRepositoryImpl } from './infrastructure/steam/SteamSearchRepositoryImpl'
import { SteamWishlistRepositoryImpl } from './infrastructure/steam/SteamWishlistRepositoryImpl'
import { SteamAchievementsRepositoryImpl } from './infrastructure/steam/SteamAchievementsRepositoryImpl'
import { GGDealsApiClient } from './infrastructure/ggdeals/GGDealsApiClient'
import { DealsRepositoryImpl } from './infrastructure/ggdeals/DealsRepositoryImpl'
import { ElectronNotificationService } from './infrastructure/notifications/ElectronNotificationService'
import { PollingScheduler } from './infrastructure/scheduler/PollingScheduler'
import { LastRunScheduler } from './infrastructure/scheduler/LastRunScheduler'
import { TrayController } from './infrastructure/tray/TrayController'
import { AutoLaunchService } from './infrastructure/autostart/AutoLaunchService'
import { JsonPriceHistoryRepository } from './infrastructure/storage/JsonPriceHistoryRepository'
import { JsonHistoryRepository } from './infrastructure/storage/JsonHistoryRepository'
import { JsonPollingStateRepository } from './infrastructure/storage/JsonPollingStateRepository'
import { JsonSessionLogRepository } from './infrastructure/storage/JsonSessionLogRepository'
import { SyncSteamLibrary } from './domain/use-cases/SyncSteamLibrary'
import { AddWishlistItem } from './domain/use-cases/AddWishlistItem'
import { RemoveWishlistItem } from './domain/use-cases/RemoveWishlistItem'
import { RefreshWishlistPrices } from './domain/use-cases/RefreshWishlistPrices'
import { SyncSteamWishlist } from './domain/use-cases/SyncSteamWishlist'
import { FetchOwnableDeals } from './domain/use-cases/FetchOwnableDeals'
import { ResolveMissingMetadata } from './domain/use-cases/ResolveMissingMetadata'
import { RefreshLibraryMetadata } from './domain/use-cases/RefreshLibraryMetadata'
import { FetchSingleGameMetadata } from './domain/use-cases/FetchSingleGameMetadata'
import { SingleGameFetchProgressTracker } from './domain/SingleGameFetchProgressTracker'
import { FetchGameAchievements } from './domain/use-cases/FetchGameAchievements'
import { CheckDealAlerts } from './domain/use-cases/CheckDealAlerts'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'

const startedHidden = process.argv.includes('--hidden')
let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Necessário no Windows pra notificações mostrarem o nome/ícone certo do app.
app.setAppUserModelId('com.gamepriceanalyzer.app')

// Precisa rodar antes de app.whenReady() — a Electron não deixa registrar privilégios de scheme
// customizado depois que o app já está pronto.
registerImageProtocolPrivileges()
registerVideoProtocolPrivileges()

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
  const sessionLogRepository = new JsonSessionLogRepository()
  sessionLogRepository.startSession()

  app.on('before-quit', () => {
    isQuitting = true
    sessionLogRepository.endSession()
  })

  const secretsStore = new SecretsStore()
  const settingsRepository = new ElectronStoreSettingsRepository()
  const cacheRepository = new ElectronStoreAppCacheRepository()
  const notifiedDealsRepository = new ElectronStoreNotifiedDealsRepository()
  const historyRepository = new JsonHistoryRepository()
  const autoLaunchService = new AutoLaunchService()

  const steamClient = new SteamWebApiClient(() => secretsStore.get('steamApiKey'))
  const steamLibraryRepository = new SteamLibraryRepositoryImpl(steamClient)
  const steamAchievementsRepository = new SteamAchievementsRepositoryImpl(steamClient)
  const localImageCache = new LocalImageCache()
  handleImageProtocol(getLocalMediaRootDir())
  const localTrailerCache = new LocalTrailerCache()
  handleVideoProtocol(getLocalMediaRootDir())
  const singleGameFetchProgressTracker = new SingleGameFetchProgressTracker()
  const metadataRepository = new LocalTrailerCachingGameMetadataRepository(
    new LocalImageCachingGameMetadataRepository(
      new ThrottledGameMetadataRepository(new SteamStoreMetadataRepositoryImpl()),
      settingsRepository,
      localImageCache,
      singleGameFetchProgressTracker
    ),
    settingsRepository,
    localTrailerCache,
    singleGameFetchProgressTracker
  )
  const steamSearchRepository = new SteamSearchRepositoryImpl()
  const steamWishlistRepository = new SteamWishlistRepositoryImpl()
  const priceHistoryRepository = new JsonPriceHistoryRepository()

  const ggDealsClient = new GGDealsApiClient(() => secretsStore.get('ggDealsApiKey'), sessionLogRepository)
  const dealsRepository = new DealsRepositoryImpl(ggDealsClient)

  const syncSteamLibrary = new SyncSteamLibrary(
    steamLibraryRepository,
    cacheRepository,
    historyRepository,
    sessionLogRepository
  )
  const addWishlistItem = new AddWishlistItem(metadataRepository, cacheRepository, historyRepository)
  const removeWishlistItem = new RemoveWishlistItem(cacheRepository, historyRepository)
  const refreshWishlistPrices = new RefreshWishlistPrices(
    dealsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository,
    sessionLogRepository
  )
  const syncSteamWishlist = new SyncSteamWishlist(
    steamWishlistRepository,
    metadataRepository,
    cacheRepository,
    historyRepository,
    sessionLogRepository
  )
  const fetchOwnableDeals = new FetchOwnableDeals(
    dealsRepository,
    metadataRepository,
    priceHistoryRepository,
    cacheRepository,
    sessionLogRepository
  )
  const resolveMissingMetadata = new ResolveMissingMetadata(
    cacheRepository,
    metadataRepository,
    sessionLogRepository
  )
  const refreshLibraryMetadata = new RefreshLibraryMetadata(
    cacheRepository,
    metadataRepository,
    sessionLogRepository
  )
  const fetchSingleGameMetadata = new FetchSingleGameMetadata(
    cacheRepository,
    metadataRepository,
    sessionLogRepository,
    singleGameFetchProgressTracker
  )
  const fetchGameAchievements = new FetchGameAchievements(steamAchievementsRepository)

  mainWindow = createMainWindow()

  const notificationService = new ElectronNotificationService(() => mainWindow, settingsRepository)
  const checkDealAlerts = new CheckDealAlerts(
    fetchOwnableDeals,
    notifiedDealsRepository,
    notificationService,
    historyRepository,
    settingsRepository,
    sessionLogRepository
  )

  const pollingStateRepository = new JsonPollingStateRepository()
  const scheduler = new PollingScheduler(
    async () => {
      await checkDealAlerts.execute()
    },
    pollingStateRepository,
    sessionLogRepository
  )
  scheduler.start(settingsRepository.get().polling.intervalMinutes)

  const trayController = new TrayController(
    () => mainWindow,
    () => scheduler.runNow()
  )
  trayController.create()

  autoLaunchService.setEnabled(settingsRepository.get().autoStartOnBoot)

  // Mantém a wishlist sempre atualizada sozinha, desde a última sincronização
  // real (não a cada vez que o app abre) — intervalo configurável em
  // Configurações, sem martelar o rate limit informal da Steam.
  const wishlistSyncStateRepository = new JsonPollingStateRepository('wishlist-sync-state.json')
  const wishlistSyncScheduler = new LastRunScheduler(
    'Atualização de Wishlist',
    async () => {
      const steamId64 = settingsRepository.get().steamId64
      if (!steamId64) return
      await syncSteamWishlist.execute(steamId64)
    },
    wishlistSyncStateRepository,
    sessionLogRepository,
    settingsRepository.get().polling.wishlistSyncIntervalMinutes
  )
  wishlistSyncScheduler.start()

  // Reconfere a metadata de TODA a biblioteca a cada 24h — diferente de ResolveMissingMetadata (que só
  // preenche o que falta), essa pega mudanças em quem já tinha tudo cacheado (capa nova, sinopse
  // editada, gênero atualizado etc.).
  const libraryMetadataRefreshStateRepository = new JsonPollingStateRepository(
    'library-metadata-refresh-state.json'
  )
  const LIBRARY_METADATA_REFRESH_INTERVAL_MINUTES = 24 * 60
  const libraryMetadataRefreshScheduler = new LastRunScheduler(
    'Reconferência de metadata da biblioteca',
    async () => {
      await refreshLibraryMetadata.execute()
    },
    libraryMetadataRefreshStateRepository,
    sessionLogRepository,
    LIBRARY_METADATA_REFRESH_INTERVAL_MINUTES
  )
  libraryMetadataRefreshScheduler.start()

  // Ping periódico no Log da Sessão com quanto falta pra próxima busca/sync,
  // pra acompanhar sem precisar esperar o próprio evento acontecer.
  const STATUS_PING_INTERVAL_MS = 5 * 60 * 1000
  setInterval(() => {
    scheduler.logStatus()
    wishlistSyncScheduler.logStatus()
    libraryMetadataRefreshScheduler.logStatus()
  }, STATUS_PING_INTERVAL_MS)

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
    notificationService,
    notifiedDealsRepository,
    resolveMissingMetadata,
    fetchSingleGameMetadata,
    fetchGameAchievements,
    sessionLogRepository,
    pollingStateRepository,
    wishlistSyncScheduler
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
  sessionLogRepository.log('info', 'GamePriceAnalyzer iniciado.')
}
