/**
 * Extrai toda URI referenciada num manifest HLS (.m3u8) — tanto as que aparecem como atributo
 * (`URI="..."` em `#EXT-X-MEDIA`/`#EXT-X-MAP`, usadas pra faixa de áudio e o segmento de inicialização)
 * quanto as que são a própria linha (variantes de vídeo depois de `#EXT-X-STREAM-INF`, e os segmentos de
 * mídia). Usado pra espelhar o manifest inteiro (+ tudo que ele referencia) localmente.
 */
export function extractM3u8References(manifestText: string): string[] {
  const refs: string[] = []

  for (const rawLine of manifestText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#')) {
      const uriMatch = line.match(/URI="([^"]+)"/)
      if (uriMatch) refs.push(uriMatch[1])
      continue
    }

    refs.push(line)
  }

  return refs
}
