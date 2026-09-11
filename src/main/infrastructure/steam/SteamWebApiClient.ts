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

interface ResolveVanityUrlResponse {
  response: {
    success: number
    steamid?: string
    message?: string
  }
}

/**
 * Cliente fino para a Steam Web API (IPlayerService/GetOwnedGames).
 * Requer que o perfil Steam esteja público (ou "game details" público).
 */
export class SteamWebApiClient {
  constructor(private readonly apiKeyProvider: () => string | null) {}

  async getOwnedGames(steamId64: string): Promise<OwnedGame[]> {
    const apiKey = this.apiKeyProvider()?.trim()
    if (!apiKey) {
      throw new Error('STEAM_API_KEY não configurada. Cadastre a chave em Configurações.')
    }

    const resolvedSteamId64 = await this.resolveSteamId64(steamId64.trim(), apiKey)

    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('steamid', resolvedSteamId64)
    url.searchParams.set('format', 'json')
    url.searchParams.set('include_appinfo', 'true')
    url.searchParams.set('include_played_free_games', 'true')

    const res = await fetchWithRetry(url)
    if (res.status === 403) {
      throw new Error('Steam recusou a chave da API (403). Verifique se copiou a chave certa em Configurações.')
    }
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

  /**
   * Aceita o SteamID64 puro, a URL de perfil (/profiles/<id> ou /id/<vanity>)
   * ou só o nome personalizado, e sempre devolve o SteamID64 numérico.
   */
  private async resolveSteamId64(input: string, apiKey: string): Promise<string> {
    if (/^\d{17}$/.test(input)) return input

    const profileIdMatch = input.match(/\/profiles\/(\d{17})/)
    if (profileIdMatch) return profileIdMatch[1]

    const vanityMatch = input.match(/\/id\/([^/]+)/)
    const vanityName = vanityMatch ? vanityMatch[1] : input

    const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('vanityurl', vanityName)

    const res = await fetchWithRetry(url)
    if (!res.ok) {
      throw new Error(`Falha ao resolver SteamID a partir de "${input}": HTTP ${res.status}`)
    }

    const data = (await res.json()) as ResolveVanityUrlResponse
    if (data.response.success !== 1 || !data.response.steamid) {
      throw new Error(
        `Não encontrei um perfil Steam pra "${input}". Confira o SteamID64, a URL do perfil ou o nome personalizado em Configurações.`
      )
    }

    return data.response.steamid
  }
}
