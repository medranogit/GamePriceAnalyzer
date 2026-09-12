import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  GameDeal,
  HistoryEvent,
  OwnedGame,
  SessionLogEntry,
  SessionLogSession,
  SteamSearchResult,
  WishlistItem,
  WishlistPriceInfo
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
    add: (appId: number): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistAdd, appId),
    remove: (appId: number): Promise<WishlistItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.wishlistRemove, appId),
    refreshPrices: (): Promise<WishlistPriceInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistRefreshPrices),
    syncFromSteam: (): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistSyncFromSteam)
  },
  steam: {
    searchGames: (query: string): Promise<SteamSearchResult[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.steamSearchGames, query)
  },
  deals: {
    getCached: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.dealsGetCached),
    getWishlistCached: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistDealsGetCached)
  },
  polling: {
    triggerNow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.pollingTriggerNow),
    getStatus: (): Promise<{ lastRunAt: string | null; intervalMinutes: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.pollingGetStatus)
  },
  metadata: {
    resolveMissing: (): Promise<{ resolved: number; failed: number; synced: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.metadataResolveMissing)
  },
  notifications: {
    test: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.notificationsTest),
    clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.notifiedDealsClear)
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
    getEvents: (): Promise<HistoryEvent[]> => ipcRenderer.invoke(IPC_CHANNELS.historyGetEvents)
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
  }
}

export type RendererApi = typeof api

contextBridge.exposeInMainWorld('api', api)
