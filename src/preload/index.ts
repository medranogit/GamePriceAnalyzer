import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  GameDeal,
  OwnedGame,
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
    import: (filePath?: string): Promise<WishlistItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.wishlistImport, filePath),
    add: (appId: number): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistAdd, appId),
    remove: (appId: number): Promise<WishlistItem[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistRemove, appId),
    refreshPrices: (): Promise<WishlistPriceInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.wishlistRefreshPrices)
  },
  steam: {
    searchGames: (query: string): Promise<SteamSearchResult[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.steamSearchGames, query)
  },
  deals: {
    getCached: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.dealsGetCached),
    fetch: (): Promise<GameDeal[]> => ipcRenderer.invoke(IPC_CHANNELS.dealsFetch)
  },
  polling: {
    triggerNow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.pollingTriggerNow)
  },
  app: {
    pickWishlistFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.pickWishlistFile)
  },
  secrets: {
    status: (): Promise<{ hasSteamApiKey: boolean; hasGGDealsApiKey: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsStatus),
    setSteamApiKey: (value: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsSetSteamApiKey, value),
    setGGDealsApiKey: (value: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.secretsSetGGDealsApiKey, value)
  },
  onDealsFound: (callback: (deal: GameDeal) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, deal: GameDeal): void => callback(deal)
    ipcRenderer.on(IPC_CHANNELS.dealsFoundEvent, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.dealsFoundEvent, listener)
  }
}

export type RendererApi = typeof api

contextBridge.exposeInMainWorld('api', api)
