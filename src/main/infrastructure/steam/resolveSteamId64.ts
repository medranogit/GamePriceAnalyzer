import { fetchWithRetry } from '../http/fetchWithRetry'

/**
 * Aceita o SteamID64 puro, a URL de perfil (/profiles/<id> ou /id/<vanity>)
 * ou só o nome personalizado, e sempre devolve o SteamID64 numérico —
 * sem precisar de chave de API (usa o feed XML público do perfil).
 */
export async function resolveSteamId64(input: string): Promise<string> {
  const trimmed = input.trim()

  if (/^\d{17}$/.test(trimmed)) return trimmed

  const profileIdMatch = trimmed.match(/\/profiles\/(\d{17})/)
  if (profileIdMatch) return profileIdMatch[1]

  const vanityMatch = trimmed.match(/\/id\/([^/]+)/)
  const vanityName = vanityMatch ? vanityMatch[1] : trimmed

  const url = `https://steamcommunity.com/id/${encodeURIComponent(vanityName)}/?xml=1`
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    throw new Error(`Falha ao resolver SteamID a partir de "${input}": HTTP ${res.status}`)
  }

  const xml = await res.text()
  const idMatch = xml.match(/<steamID64>(\d+)<\/steamID64>/)
  if (!idMatch) {
    throw new Error(
      `Não encontrei um perfil Steam pra "${input}". Confira o SteamID64, a URL do perfil ou o nome personalizado em Configurações.`
    )
  }

  return idMatch[1]
}
