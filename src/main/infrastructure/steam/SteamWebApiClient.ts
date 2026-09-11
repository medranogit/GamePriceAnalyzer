import type { OwnedGame } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'

interface SteamGetOwnedGamesResponse {
  response: {
    game_count?: number
    games?: Array<{
      appid: number
      name: string
      playtime_forever: number
      img_icon_url?: string
    }>
  }
}

/**
 * Cliente fino para a Steam Web API (IPlayerService/GetOwnedGames).
 * Requer que o perfil Steam esteja público (ou "game details" público).
 */
export class SteamWebApiClient {
  constructor(private readonly apiKeyProvider: () => string | null) {}

  async getOwnedGames(steamId64: string): Promise<OwnedGame[]> {
    const apiKey = this.apiKeyProvider()
    if (!apiKey) {
      throw new Error('STEAM_API_KEY não configurada. Cadastre a chave em Configurações.')
    }

    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('steamid', steamId64)
    url.searchParams.set('format', 'json')
    url.searchParams.set('include_appinfo', 'true')
    url.searchParams.set('include_played_free_games', 'true')

    const res = await fetchWithRetry(url)
    if (!res.ok) {
      throw new Error(`Steam GetOwnedGames falhou: HTTP ${res.status}`)
    }

    const data = (await res.json()) as SteamGetOwnedGamesResponse
    const games = data.response.games ?? []

    if (games.length === 0) {
      logger.warn(
        'GetOwnedGames retornou 0 jogos. Verifique se o perfil Steam está público (Detalhes do jogo).'
      )
    }

    return games.map((game) => ({
      appId: game.appid,
      name: game.name,
      playtimeForeverMinutes: game.playtime_forever,
      iconUrl: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : undefined
    }))
  }
}
