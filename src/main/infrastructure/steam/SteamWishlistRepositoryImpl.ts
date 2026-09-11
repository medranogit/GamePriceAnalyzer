import type { SteamWishlistEntry, SteamWishlistRepository } from '../../domain/repositories/SteamWishlistRepository'
import { resolveSteamId64 } from './resolveSteamId64'
import { fetchWithRetry } from '../http/fetchWithRetry'

interface RawWishlistResponse {
  response: {
    items?: Array<{ appid: number; priority: number; date_added: number }>
  }
}

/**
 * IWishlistService/GetWishlist — endpoint oficial da Steam Web API, não
 * precisa de chave, só do SteamID64 (perfil precisa estar público). Devolve
 * só AppID + data — sem título/preço, que a gente já resolve por outro lado.
 */
export class SteamWishlistRepositoryImpl implements SteamWishlistRepository {
  async fetchWishlistAppIds(steamId64: string): Promise<SteamWishlistEntry[]> {
    const resolvedSteamId64 = await resolveSteamId64(steamId64)

    const url = new URL('https://api.steampowered.com/IWishlistService/GetWishlist/v1/')
    url.searchParams.set('steamid', resolvedSteamId64)

    const res = await fetchWithRetry(url)
    if (!res.ok) {
      throw new Error(`Steam GetWishlist falhou: HTTP ${res.status}`)
    }

    const data = (await res.json()) as RawWishlistResponse
    const items = data.response.items ?? []

    return items.map((item) => ({
      appId: item.appid,
      addedAt: new Date(item.date_added * 1000).toISOString()
    }))
  }
}
