import dayjs from 'dayjs'

export function formatPrice(currency: string | null, value: number | null): string {
  if (value === null) return '—'
  return `${currency ?? ''} ${value.toFixed(2)}`.trim()
}

export function formatDate(iso: string | null): string {
  return iso ? dayjs(iso).format('DD/MM/YYYY') : ''
}

export function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('pt-BR').format(value)
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'a qualquer momento'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (hours > 0 || minutes > 0) parts.push(`${minutes}min`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}
