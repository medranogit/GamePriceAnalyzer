import { ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import type { AppSettings, GameDeal, TimerStatus } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { getGameMediaDir } from '../infrastructure/storage/localMediaPaths'
import type { SettingsRepository } from '../domain/repositories/SettingsRepository'
import type { AppCacheRepository } from '../domain/repositories/AppCacheRepository'
import type { RemoveWishlistItem } from '../domain/use-cases/RemoveWishlistItem'
import type { PollingScheduler } from '../infrastructure/scheduler/PollingScheduler'
import type { SecretsStore } from '../infrastructure/secrets/SecretsStore'
import type { AutoLaunchService } from '../infrastructure/autostart/AutoLaunchService'
import type { HistoryRepository } from '../domain/repositories/HistoryRepository'
import type { NotificationService } from '../domain/use-cases/CheckDealAlerts'
import type { SessionLogRepository } from '../domain/repositories/SessionLogRepository'
import type { PollingStateRepository } from '../domain/repositories/PollingStateRepository'
import type { LastRunScheduler } from '../infrastructure/scheduler/LastRunScheduler'
import type { NotifiedDealsRepository } from '../domain/repositories/NotifiedDealsRepository'
import type {
  ResolveMissingMetadata,
  ResolveMissingMetadataScope
} from '../domain/use-cases/ResolveMissingMetadata'
import type { RefreshLibraryMetadata } from '../domain/use-cases/RefreshLibraryMetadata'
import type { FetchSingleGameMetadata } from '../domain/use-cases/FetchSingleGameMetadata'
import type { FetchGameAchievements } from '../domain/use-cases/FetchGameAchievements'
import type { QueueActivityTracker } from '../domain/QueueActivityTracker'
import type { GGDealsApiClient } from '../infrastructure/ggdeals/GGDealsApiClient'
import type { PriceHistoryRepository } from '../domain/repositories/PriceHistoryRepository'
import type { SetDlcManualOwnership } from '../domain/use-cases/SetDlcManualOwnership'

interface Dependencies {
  settingsRepository: SettingsRepository
  cacheRepository: AppCacheRepository
  historyRepository: HistoryRepository
  priceHistoryRepository: PriceHistoryRepository
  setDlcManualOwnership: SetDlcManualOwnership
  notificationService: NotificationService
  notifiedDealsRepository: NotifiedDealsRepository
  resolveMissingMetadata: ResolveMissingMetadata
  refreshLibraryMetadata: RefreshLibraryMetadata
  fetchSingleGameMetadata: FetchSingleGameMetadata
  fetchGameAchievements: FetchGameAchievements
  librarySyncScheduler: LastRunScheduler
  metadataBackfillScheduler: LastRunScheduler
  ggDealsQueueTracker: QueueActivityTracker
  steamMetadataQueueTracker: QueueActivityTracker
  ggDealsClient: GGDealsApiClient
  removeWishlistItem: RemoveWishlistItem
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
    if (partial.polling?.librarySyncIntervalMinutes) {
      deps.librarySyncScheduler.setIntervalMinutes(updated.polling.librarySyncIntervalMinutes)
    }
    if (partial.polling?.metadataBackfillIntervalMinutes) {
      deps.metadataBackfillScheduler.setIntervalMinutes(updated.polling.metadataBackfillIntervalMinutes)
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
    // Passa pelo scheduler (não chama o use-case direto) pra `isRunning()`/timer refletir corretamente
    // essa chamada manual, e pra já reagendar o próximo tick automático a partir de agora.
    await deps.librarySyncScheduler.runNow()
    return deps.cacheRepository.getOwnedGames()
  })

  ipcMain.handle(IPC_CHANNELS.wishlistGetCached, () => deps.cacheRepository.getWishlist())

  ipcMain.handle(IPC_CHANNELS.wishlistRemove, (_event, appId: number) =>
    deps.removeWishlistItem.execute(appId)
  )

  ipcMain.handle(IPC_CHANNELS.wishlistSyncFromSteam, async () => {
    const settings = deps.settingsRepository.get()
    if (!settings.steamId64) {
      throw new Error('SteamID64 não configurado. Cadastre em Configurações.')
    }
    // Passa pelo scheduler (não chama o use-case direto) pra `isRunning()`/timer refletir corretamente
    // essa chamada manual, e pra já reagendar o próximo tick automático a partir de agora.
    await deps.wishlistSyncScheduler.runNow()
    return deps.cacheRepository.getWishlist()
  })

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

  ipcMain.handle(IPC_CHANNELS.historyRemoveEvents, (_event, ids: string[]) =>
    deps.historyRepository.removeEvents(ids)
  )

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

  ipcMain.handle(IPC_CHANNELS.metadataResolveMissing, (_event, scope?: ResolveMissingMetadataScope) =>
    deps.resolveMissingMetadata.execute(scope)
  )

  ipcMain.handle(IPC_CHANNELS.metadataResolveCancel, () => {
    deps.resolveMissingMetadata.cancel()
  })

  ipcMain.handle(IPC_CHANNELS.metadataResolveStatus, () => ({
    resolving: deps.resolveMissingMetadata.isResolving()
  }))

  ipcMain.handle(IPC_CHANNELS.metadataResolveOne, (_event, appId: number) =>
    deps.fetchSingleGameMetadata.execute(appId)
  )

  ipcMain.handle(IPC_CHANNELS.metadataResolveOneProgress, (_event, appId: number) =>
    deps.fetchSingleGameMetadata.getProgress(appId)
  )

  ipcMain.handle(IPC_CHANNELS.metadataGetAll, () => deps.cacheRepository.getAllMetadata())

  ipcMain.handle(IPC_CHANNELS.metadataRefreshAll, () => {
    // A busca incondicional que tá prestes a rodar já cobre tudo — reseta o timer dos outros dois
    // schedulers de metadata Steam pra não rodarem de novo em cima do que acabou de ser forçado. O
    // ciclo de Ofertas/GG.deals não entra nisso (preço precisa ser reconferido sempre).
    deps.librarySyncScheduler.notifyExternalRun()
    deps.metadataBackfillScheduler.notifyExternalRun()
    return deps.refreshLibraryMetadata.execute('all')
  })

  ipcMain.handle(IPC_CHANNELS.queuesGetGGDeals, () => deps.ggDealsQueueTracker.getSnapshot())

  ipcMain.handle(IPC_CHANNELS.queuesGetGGDealsQuota, () => deps.ggDealsClient.getQuotaStatus())

  ipcMain.handle(IPC_CHANNELS.priceHistoryGetForAppId, (_event, appId: number) =>
    deps.priceHistoryRepository.getRecord(appId)
  )

  ipcMain.handle(IPC_CHANNELS.dlcGetManuallyOwned, () => deps.cacheRepository.getManuallyOwnedDlcAppIds())

  ipcMain.handle(IPC_CHANNELS.dlcSetManuallyOwned, (_event, appId: number, owned: boolean) =>
    deps.setDlcManualOwnership.execute(appId, owned)
  )

  ipcMain.handle(IPC_CHANNELS.queuesGetSteamMetadata, () => deps.steamMetadataQueueTracker.getSnapshot())

  ipcMain.handle(IPC_CHANNELS.timersGetAll, (): TimerStatus[] => [
    {
      key: 'ofertas',
      label: 'Ofertas (GG.deals)',
      lastRunAt: deps.scheduler.getLastRunAt(),
      intervalMinutes: deps.scheduler.getIntervalMinutes(),
      running: deps.scheduler.isRunning()
    },
    {
      key: 'wishlist',
      label: 'Sincronização da Wishlist',
      lastRunAt: deps.wishlistSyncScheduler.getLastRunAt(),
      intervalMinutes: deps.wishlistSyncScheduler.getIntervalMinutes(),
      running: deps.wishlistSyncScheduler.isRunning()
    },
    {
      key: 'biblioteca',
      label: 'Sincronização da Biblioteca',
      lastRunAt: deps.librarySyncScheduler.getLastRunAt(),
      intervalMinutes: deps.librarySyncScheduler.getIntervalMinutes(),
      running: deps.librarySyncScheduler.isRunning()
    },
    {
      key: 'backfill',
      label: 'Backfill de metadata faltando',
      lastRunAt: deps.metadataBackfillScheduler.getLastRunAt(),
      intervalMinutes: deps.metadataBackfillScheduler.getIntervalMinutes(),
      running: deps.metadataBackfillScheduler.isRunning()
    }
  ])

  ipcMain.handle(IPC_CHANNELS.localMediaOpenGameFolder, async (_event, appId: number) => {
    const dir = getGameMediaDir(appId)
    await mkdir(dir, { recursive: true })
    const error = await shell.openPath(dir)
    if (error) throw new Error(error)
  })

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
    trailers: [],
    firstSeenAt: new Date().toISOString(),
    ...overrides
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
