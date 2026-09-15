import type { GameMetadata } from '@shared/types'

/** Resumo curto do que a metadata resolvida trouxe — usado nos logs da sessão pra detalhar o que cada
 * timer/busca de fato encontrou (capa, sinopse, quantos screenshots/trailers/DLCs etc.), não só
 * "resolvido". */
export function describeMetadata(metadata: GameMetadata): string {
  const parts: string[] = []
  if (metadata.headerImageUrl) parts.push('capa')
  if (metadata.shortDescription) parts.push('sinopse')
  if (metadata.genres.length > 0) parts.push(`${metadata.genres.length} gênero(s)`)
  if (metadata.screenshots.length > 0) parts.push(`${metadata.screenshots.length} screenshot(s)`)
  if (metadata.trailers.length > 0) parts.push(`${metadata.trailers.length} trailer(s)`)
  if (metadata.dlcAppIds.length > 0) parts.push(`${metadata.dlcAppIds.length} DLC(s)`)
  if (metadata.isDlc) parts.push('é DLC')
  return parts.length > 0 ? parts.join(', ') : 'sem dados adicionais'
}
