import type { GameMetadata } from '@shared/types'

/** Todo campo de GameMetadata exceto o id — usado só pra detectar cache incompleto (ver isMetadataIncomplete). */
const METADATA_FIELDS: Array<keyof GameMetadata> = [
  'title',
  'genres',
  'headerImageUrl',
  'steamPrice',
  'steamDiscountPercent',
  'steamFullPrice',
  'shortDescription',
  'developers',
  'publishers',
  'releaseDate',
  'metacriticScore',
  'recommendationsTotal',
  'screenshots',
  'trailers',
  'dlcAppIds',
  'isDlc',
  'parentAppId'
]

/**
 * Considera "incompleta" tanto a ausência total de metadata quanto uma
 * metadata cacheada por uma versão anterior de GameMetadata — checa contra
 * TODOS os campos atuais (METADATA_FIELDS), não um campo específico, então
 * um campo novo adicionado no futuro já é pego automaticamente, sem
 * precisar lembrar de atualizar essa checagem de novo.
 *
 * Um campo resolvido como `[]`/`null` (ex: jogo sem trailer na Steam) conta
 * como completo — só `undefined` (campo que nunca foi buscado) conta como
 * incompleto, senão jogos sem trailer ficariam sendo buscados pra sempre.
 */
export function isMetadataIncomplete(metadata: GameMetadata | null): boolean {
  if (!metadata) return true
  return METADATA_FIELDS.some((field) => metadata[field] === undefined)
}
