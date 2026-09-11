export const IPC_CHANNELS = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  libraryGetCached: 'library:getCached',
  librarySync: 'library:sync',
  wishlistGetCached: 'wishlist:getCached',
  wishlistImport: 'wishlist:import',
  wishlistAdd: 'wishlist:add',
  wishlistRemove: 'wishlist:remove',
  wishlistRefreshPrices: 'wishlist:refreshPrices',
  steamSearchGames: 'steam:searchGames',
  dealsGetCached: 'deals:getCached',
  dealsFetch: 'deals:fetch',
  pollingTriggerNow: 'polling:triggerNow',
  pickWishlistFile: 'app:pickWishlistFile',
  secretsStatus: 'secrets:status',
  secretsSetSteamApiKey: 'secrets:setSteamApiKey',
  secretsSetGGDealsApiKey: 'secrets:setGGDealsApiKey',
  dealsFoundEvent: 'event:dealsFound'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
