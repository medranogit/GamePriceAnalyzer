import { afterEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipc/channels'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler)
    }
  }
}))

const { registerIpcHandlers } = await import('./registerIpcHandlers')

function makeDeps(notifyDeal: () => void): Parameters<typeof registerIpcHandlers>[0] {
  const noop = vi.fn()
  return {
    settingsRepository: { get: () => ({ steamId64: null }) as never, update: noop },
    cacheRepository: {
      getOwnedGames: () => [],
      setOwnedGames: noop,
      getWishlist: () => [],
      setWishlist: noop,
      getDeals: () => [],
      setDeals: noop,
      getWishlistDeals: () => [],
      setWishlistDeals: noop,
      getMetadata: () => null,
      setMetadata: noop,
      getAllMetadata: () => [],
      getPendingDealsAppIds: () => [],
      setPendingDealsAppIds: noop,
      getPendingLibraryRefreshAppIds: () => [],
      setPendingLibraryRefreshAppIds: noop
    },
    historyRepository: { getEvents: () => [], addEvent: noop },
    notificationService: { notifyDeal, notifyDealsBatch: noop, dismissAll: noop },
    notifiedDealsRepository: {
      alreadyNotifiedForPrice: () => false,
      markNotified: noop,
      clearForAppId: noop,
      clear: noop
    },
    resolveMissingMetadata: { execute: noop } as never,
    refreshLibraryMetadata: { execute: noop } as never,
    fetchSingleGameMetadata: { execute: noop } as never,
    fetchGameAchievements: { execute: noop } as never,
    librarySyncScheduler: { setIntervalMinutes: noop, notifyExternalRun: noop, runNow: noop } as never,
    metadataBackfillScheduler: { setIntervalMinutes: noop, notifyExternalRun: noop } as never,
    ggDealsQueueTracker: { getSnapshot: () => [] } as never,
    steamMetadataQueueTracker: { getSnapshot: () => [] } as never,
    addWishlistItem: { execute: noop } as never,
    removeWishlistItem: { execute: noop } as never,
    refreshWishlistPrices: { execute: noop } as never,
    steamSearchRepository: { searchGames: noop as never },
    scheduler: { runNow: noop, updateInterval: noop, start: noop, logStatus: noop } as never,
    secretsStore: { get: () => null, set: noop } as never,
    autoLaunchService: { setEnabled: noop } as never,
    sessionLogRepository: {
      startSession: () => 'session-id',
      log: noop,
      endSession: noop,
      listSessions: () => [],
      getEntries: () => [],
      deleteSession: noop
    },
    pollingStateRepository: { getLastRunAt: () => null, setLastRunAt: noop },
    wishlistSyncScheduler: { setIntervalMinutes: noop, notifyExternalRun: noop, runNow: noop } as never
  }
}

describe('registerIpcHandlers — teste de notificações', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('para de disparar notificações de teste assim que "Limpar notificações" é chamado no meio da sequência', async () => {
    vi.useFakeTimers()
    const notifyDeal = vi.fn()
    registerIpcHandlers(makeDeps(notifyDeal))

    const testHandler = handlers.get(IPC_CHANNELS.notificationsTest)!
    const dismissAllHandler = handlers.get(IPC_CHANNELS.notificationsDismissAll)!

    const testPromise = testHandler({})
    // deixa a primeira notificação de teste disparar, então "limpa" antes das outras duas
    await vi.advanceTimersByTimeAsync(0)
    expect(notifyDeal).toHaveBeenCalledTimes(1)
    dismissAllHandler({})

    await vi.runAllTimersAsync()
    await testPromise

    expect(notifyDeal).toHaveBeenCalledTimes(1)
  })
})
