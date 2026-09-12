import { ipcMain } from 'electron'
import type { AppSettings, GameDeal } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import type { SettingsRepository } from '../domain/repositories/SettingsRepository'
import type { AppCacheRepository } from '../domain/repositories/AppCacheRepository'
import type { SyncSteamLibrary } from '../domain/use-cases/SyncSteamLibrary'
import type { AddWishlistItem } from '../domain/use-cases/AddWishlistItem'
import type { RemoveWishlistItem } from '../domain/use-cases/RemoveWishlistItem'
import type { RefreshWishlistPrices } from '../domain/use-cases/RefreshWishlistPrices'
import type { SyncSteamWishlist } from '../domain/use-cases/SyncSteamWishlist'
import type { SteamSearchRepository } from '../domain/repositories/SteamSearchRepository'
import type { PollingScheduler } from '../infrastructure/scheduler/PollingScheduler'
import type { SecretsStore } from '../infrastructure/secrets/SecretsStore'
import type { AutoLaunchService } from '../infrastructure/autostart/AutoLaunchService'
import type { HistoryRepository } from '../domain/repositories/HistoryRepository'
import type { NotificationService } from '../domain/use-cases/CheckDealAlerts'
import type { SessionLogRepository } from '../domain/repositories/SessionLogRepository'
import type { PollingStateRepository } from '../domain/repositories/PollingStateRepository'
import type { LastRunScheduler } from '../infrastructure/scheduler/LastRunScheduler'
import type { NotifiedDealsRepository } from '../domain/repositories/NotifiedDealsRepository'
import type { ResolveMissingMetadata } from '../domain/use-cases/ResolveMissingMetadata'
import type { FetchGameAchievements } from '../domain/use-cases/FetchGameAchievements'

interface Dependencies {
  settingsRepository: SettingsRepository
  cacheRepository: AppCacheRepository
  historyRepository: HistoryRepository
  notificationService: NotificationService
  notifiedDealsRepository: NotifiedDealsRepository
  resolveMissingMetadata: ResolveMissingMetadata
  fetchGameAchievements: FetchGameAchievements
  syncSteamLibrary: SyncSteamLibrary
  addWishlistItem: AddWishlistItem
  removeWishlistItem: RemoveWishlistItem
  refreshWishlistPrices: RefreshWishlistPrices
  syncSteamWishlist: SyncSteamWishlist
  steamSearchRepository: SteamSearchRepository
  scheduler: PollingScheduler
  secretsStore: SecretsStore
  autoLaunchService: AutoLaunchService
  sessionLogRepository: SessionLogRepository
  pollingStateRepository: PollingStateRepository
  wishlistSyncScheduler: LastRunScheduler
}

export function registerIpcHandlers(deps: Dependencies): void {
  // O teste de notificação dispara com pausa entre cada uma (efeito demonstrativo) — sem isso, "Limpar
  // notificações" só fecharia quem já tivesse aparecido até aquele momento, e o resto continuaria
  // disparando sozinho no meio do teste.
  const testNotificationsState = { cancelled: false }

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => deps.settingsRepository.get())

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, partial: Partial<AppSettings>) => {
    const updated = deps.settingsRepository.update(partial)
    if (partial.polling?.intervalMinutes) {
      deps.scheduler.updateInterval(updated.polling.intervalMinutes)
    }
    if (partial.polling?.wishlistSyncIntervalMinutes) {
      deps.wishlistSyncScheduler.setIntervalMinutes(updated.polling.wishlistSyncIntervalMinutes)
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

  ipcMain.handle(IPC_CHANNELS.wishlistAdd, (_event, appId: number) => deps.addWishlistItem.execute(appId))

  ipcMain.handle(IPC_CHANNELS.wishlistRemove, (_event, appId: number) =>
    deps.removeWishlistItem.execute(appId)
  )

  ipcMain.handle(IPC_CHANNELS.wishlistRefreshPrices, () => deps.refreshWishlistPrices.execute())

  ipcMain.handle(IPC_CHANNELS.wishlistSyncFromSteam, async () => {
    const settings = deps.settingsRepository.get()
    if (!settings.steamId64) {
      throw new Error('SteamID64 não configurado. Cadastre em Configurações.')
    }
    const result = await deps.syncSteamWishlist.execute(settings.steamId64)
    deps.wishlistSyncScheduler.notifyExternalRun()
    return result
  })

  ipcMain.handle(IPC_CHANNELS.steamSearchGames, (_event, query: string) =>
    deps.steamSearchRepository.searchGames(query)
  )

  ipcMain.handle(IPC_CHANNELS.dealsGetCached, () => deps.cacheRepository.getDeals())

  ipcMain.handle(IPC_CHANNELS.wishlistDealsGetCached, () => deps.cacheRepository.getWishlistDeals())

  ipcMain.handle(IPC_CHANNELS.pollingTriggerNow, () => deps.scheduler.runNow())

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

  ipcMain.handle(IPC_CHANNELS.historyGetEvents, () => deps.historyRepository.getEvents())

  ipcMain.handle(IPC_CHANNELS.sessionLogGetSessions, () => deps.sessionLogRepository.listSessions())

  ipcMain.handle(IPC_CHANNELS.sessionLogGetEntries, (_event, sessionId: string) =>
    deps.sessionLogRepository.getEntries(sessionId)
  )

  ipcMain.handle(IPC_CHANNELS.sessionLogDeleteSession, (_event, sessionId: string) =>
    deps.sessionLogRepository.deleteSession(sessionId)
  )

  ipcMain.handle(IPC_CHANNELS.pollingGetStatus, () => ({
    lastRunAt: deps.pollingStateRepository.getLastRunAt(),
    intervalMinutes: deps.settingsRepository.get().polling.intervalMinutes,
    running: deps.scheduler.isRunning()
  }))

  ipcMain.handle(IPC_CHANNELS.notificationsTest, async () => {
    testNotificationsState.cancelled = false
    const fakeDeals: GameDeal[] = [
      makeFakeDeal({
        appId: 1245620,
        title: 'Elden Ring (teste 1)',
        currency: 'BRL',
        currentRetailPrice: 149.5,
        steamDiscountPercent: 50,
        coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg'
      }),
      makeFakeDeal({
        appId: 367520,
        title: 'Hollow Knight (teste 2)',
        currency: 'BRL',
        currentKeyshopPrice: 12.9,
        steamDiscountPercent: null,
        coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg'
      }),
      makeFakeDeal({
        appId: 1086940,
        title: 'Baldur’s Gate 3 (teste 3)',
        currency: 'BRL',
        currentRetailPrice: 89.99,
        historicalRetailLow: 89.99,
        steamDiscountPercent: 65,
        coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg'
      })
    ]

    for (const deal of fakeDeals) {
      if (testNotificationsState.cancelled) break
      deps.notificationService.notifyDeal(deal)
      await sleep(1500)
    }
  })

  ipcMain.handle(IPC_CHANNELS.notifiedDealsClear, () => {
    deps.notifiedDealsRepository.clear()
  })

  ipcMain.handle(IPC_CHANNELS.notificationsDismissAll, () => {
    testNotificationsState.cancelled = true
    deps.notificationService.dismissAll()
  })

  ipcMain.handle(IPC_CHANNELS.metadataResolveMissing, () => deps.resolveMissingMetadata.execute())

  ipcMain.handle(IPC_CHANNELS.metadataResolveCancel, () => {
    deps.resolveMissingMetadata.cancel()
  })

  ipcMain.handle(IPC_CHANNELS.metadataResolveStatus, () => ({
    resolving: deps.resolveMissingMetadata.isResolving()
  }))

  ipcMain.handle(IPC_CHANNELS.metadataGetAll, () => deps.cacheRepository.getAllMetadata())

  ipcMain.handle(IPC_CHANNELS.achievementsGet, (_event, appId: number) => {
    const settings = deps.settingsRepository.get()
    if (!settings.steamId64) {
      throw new Error('SteamID64 não configurado. Cadastre em Configurações.')
    }
    return deps.fetchGameAchievements.execute(settings.steamId64, appId)
  })
}

function makeFakeDeal(overrides: Partial<GameDeal>): GameDeal {
  return {
    appId: null,
    title: 'Jogo de teste',
    genres: [],
    ggDealsUrl: '',
    currency: 'BRL',
    currentRetailPrice: null,
    currentKeyshopPrice: null,
    historicalRetailLow: null,
    historicalKeyshopLow: null,
    steamPrice: null,
    steamDiscountPercent: null,
    steamFullPrice: null,
    shortDescription: null,
    developers: [],
    publishers: [],
    releaseDate: null,
    metacriticScore: null,
    recommendationsTotal: null,
    screenshots: [],
    trailerUrl: null,
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
