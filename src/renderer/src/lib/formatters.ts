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
