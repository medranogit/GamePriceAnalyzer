import type { GameAchievements, OwnedGame } from '@shared/types'
import { logger } from '../logging/logger'
import { fetchWithRetry } from '../http/fetchWithRetry'
import { resolveSteamId64 } from './resolveSteamId64'

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

interface SteamGetSchemaForGameResponse {
  game?: {
    availableGameStats?: {
      achievements?: Array<{
        name: string
        displayName: string
        description?: string
        icon: string
        icongray: string
      }>
    }
  }
}

interface SteamGetPlayerAchievementsResponse {
  playerstats: {
    success: boolean
    error?: string
    achievements?: Array<{ apiname: string; achieved: number; unlocktime: number }>
  }
}

/**
 * Cliente fino para a Steam Web API (IPlayerService/GetOwnedGames,
 * ISteamUserStats/GetPlayerAchievements e GetSchemaForGame).
 * Requer que o perfil Steam esteja público (ou "game details" público).
 */
export class SteamWebApiClient {
  constructor(private readonly apiKeyProvider: () => string | null) {}

  private requireApiKey(): string {
    const apiKey = this.apiKeyProvider()?.trim()
    if (!apiKey) {
      throw new Error('STEAM_API_KEY não configurada. Cadastre a chave em Configurações.')
    }
    return apiKey
  }

  async getOwnedGames(steamId64: string): Promise<OwnedGame[]> {
    const apiKey = this.requireApiKey()
    const resolvedSteamId64 = await resolveSteamId64(steamId64)

    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('steamid', resolvedSteamId64)
    url.searchParams.set('format', 'json')
    url.searchParams.set('include_appinfo', 'true')
    url.searchParams.set('include_played_free_games', 'true')

    const res = await fetchWithRetry(url)
    if (res.status === 403) {
      throw new Error(
        'Steam recusou a chave da API (403). Verifique se copiou a chave certa em Configurações.'
      )
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

  async getGameAchievements(steamId64: string, appId: number): Promise<GameAchievements | null> {
    const apiKey = this.requireApiKey()
    const resolvedSteamId64 = await resolveSteamId64(steamId64)

    const schemaUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/')
    schemaUrl.searchParams.set('key', apiKey)
    schemaUrl.searchParams.set('appid', String(appId))
    schemaUrl.searchParams.set('l', 'brazilian')

    const playerUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/')
    playerUrl.searchParams.set('key', apiKey)
    playerUrl.searchParams.set('steamid', resolvedSteamId64)
    playerUrl.searchParams.set('appid', String(appId))
    playerUrl.searchParams.set('l', 'brazilian')

    const [schemaRes, playerRes] = await Promise.all([fetchWithRetry(schemaUrl), fetchWithRetry(playerUrl)])

    if (!schemaRes.ok || !playerRes.ok) {
      logger.warn(`GetSchemaForGame/GetPlayerAchievements falhou pro appId ${appId}`)
      return null
    }

    const schema = (await schemaRes.json()) as SteamGetSchemaForGameResponse
    const schemaAchievements = schema.game?.availableGameStats?.achievements ?? []
    if (schemaAchievements.length === 0) return null

    const player = (await playerRes.json()) as SteamGetPlayerAchievementsResponse
    if (!player.playerstats.success) {
      logger.warn(
        `GetPlayerAchievements sem sucesso pro appId ${appId}: ${player.playerstats.error ?? 'motivo desconhecido'}`
      )
      return null
    }

    const playerAchievementByName = new Map(
      (player.playerstats.achievements ?? []).map((a) => [a.apiname, a])
    )

    const achievements = schemaAchievements.map((schemaAchievement) => {
      const playerAchievement = playerAchievementByName.get(schemaAchievement.name)
      const achieved = playerAchievement?.achieved === 1
      return {
        apiName: schemaAchievement.name,
        displayName: schemaAchievement.displayName,
        description: schemaAchievement.description ?? null,
        achieved,
        unlockedAt:
          achieved && playerAchievement?.unlocktime
            ? new Date(playerAchievement.unlocktime * 1000).toISOString()
            : null,
        iconUrl: schemaAchievement.icon,
        iconGrayUrl: schemaAchievement.icongray
      }
    })

    return {
      appId,
      total: achievements.length,
      unlocked: achievements.filter((a) => a.achieved).length,
      achievements
    }
  }
}
