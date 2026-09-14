import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  GameAchievements,
  GameDeal,
  GameMetadata,
  HistoryEvent,
  OwnedGame,
  QueueEntry,
  SessionLogEntry,
  SessionLogSession,
  TimerStatus,
  WishlistItem
} from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc/channels'

const api = {
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, partial)
  },
  library: {
    getCached: (): Promise<OwnedGame[]> => ipcRenderer.invoke(IPC_CHANNELS.libraryGetCached),
    sync: (): Promise<OwnedGame[]> => ipcRenderer.invoke(IPC_CHANNELS.librarySync)
  },
  wishlist: {
    getCached: (): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistGetCached),
    remove: (appId: number): Promise<WishlistItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.wishlistRemove, appId),
    syncFromSteam: (): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistSyncFromSteam)
  },
  deals: {
    getCached: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.dealsGetCached),
    getWishlistCached: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistDealsGetCached)
  },
  polling: {
    triggerNow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.pollingTriggerNow),
    getStatus: (): Promise<{ lastRunAt: string | null; intervalMinutes: number; running: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.pollingGetStatus)
  },
  metadata: {
    resolveMissing: (
      scope?: 'all' | 'library'
    ): Promise<{ resolved: number; failed: number; synced: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataResolveMissing, scope),
    cancelResolve: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.metadataResolveCancel),
    getResolveStatus: (): Promise<{ resolving: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataResolveStatus),
    resolveOne: (appId: number): Promise<GameMetadata | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataResolveOne, appId),
    getResolveOneProgress: (appId: number): Promise<{ completed: number; total: number } | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataResolveOneProgress, appId),
    getAll: (): Promise<GameMetadata[]> => ipcRenderer.invoke(IPC_CHANNELS.metadataGetAll),
    refreshAll: (): Promise<{ refreshed: number; failed: number; synced: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataRefreshAll)
  },
  queues: {
    getGGDeals: (): Promise<QueueEntry[]> => ipcRenderer.invoke(IPC_CHANNELS.queuesGetGGDeals),
    getSteamMetadata: (): Promise<QueueEntry[]> => ipcRenderer.invoke(IPC_CHANNELS.queuesGetSteamMetadata)
  },
  timers: {
    getAll: (): Promise<TimerStatus[]> => ipcRenderer.invoke(IPC_CHANNELS.timersGetAll)
  },
  localMedia: {
    openGameFolder: (appId: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.localMediaOpenGameFolder, appId)
  },
  achievements: {
    get: (appId: number): Promise<GameAchievements | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.achievementsGet, appId)
  },
  notifications: {
    test: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.notificationsTest),
    clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.notifiedDealsClear),
    dismissAll: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.notificationsDismissAll)
  },
  secrets: {
    status: (): Promise<{ hasSteamApiKey: boolean; hasGGDealsApiKey: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsStatus),
    setSteamApiKey: (value: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsSetSteamApiKey, value),
    setGGDealsApiKey: (value: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsSetGGDealsApiKey, value)
  },
  history: {
    getEvents: (): Promise<HistoryEvent[]> => ipcRenderer.invoke(IPC_CHANNELS.historyGetEvents),
    removeEvents: (ids: string[]): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.historyRemoveEvents, ids)
  },
  sessionLog: {
    getSessions: (): Promise<SessionLogSession[]> => ipcRenderer.invoke(IPC_CHANNELS.sessionLogGetSessions),
    getEntries: (sessionId: string): Promise<SessionLogEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.sessionLogGetEntries, sessionId),
    deleteSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.sessionLogDeleteSession, sessionId)
  },
  onDealsFound: (callback: (deal: GameDeal) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, deal: GameDeal): void => callback(deal)
    ipcRenderer.on(IPC_CHANNELS.dealsFoundEvent, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.dealsFoundEvent, listener)
  },
  onDealsBatchFound: (callback: (deals: GameDeal[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, deals: GameDeal[]): void => callback(deals)
    ipcRenderer.on(IPC_CHANNELS.dealsBatchFoundEvent, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.dealsBatchFoundEvent, listener)
  }
}

export type RendererApi = typeof api

contextBridge.exposeInMainWorld('api', api)
