/**
 * Filtro por palavras-chave: cada palavra digitada precisa aparecer em
 * qualquer ordem no texto (ex: "ark evolved" acha "ARK: Survival Evolved").
 */
export function matchesSearchTokens(text: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = text.toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}
