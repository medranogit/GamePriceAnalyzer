import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/fake/userData' } }))

const files = new Map<string, string>()

vi.mock('node:fs', () => ({
  existsSync: (path: string) => files.has(path),
  mkdirSync: vi.fn(),
  readFileSync: (path: string) => files.get(path) ?? '',
  writeFileSync: (path: string, data: string) => {
    files.set(path, data)
  }
}))

const { JsonPriceHistoryRepository } = await import('./JsonPriceHistoryRepository')

describe('JsonPriceHistoryRepository', () => {
  it('registra o primeiro ponto do histórico na primeira observação', () => {
    files.clear()
    const repo = new JsonPriceHistoryRepository()

    const record = repo.recordObservation(10, 'BRL', 50, 40)

    expect(record.history).toHaveLength(1)
    expect(record.history[0]).toMatchObject({ retailPrice: 50, keyshopPrice: 40, currency: 'BRL' })
  })

  it('não duplica um ponto no histórico quando o preço se repete', () => {
    files.clear()
    const repo = new JsonPriceHistoryRepository()

    repo.recordObservation(10, 'BRL', 50, 40)
    const record = repo.recordObservation(10, 'BRL', 50, 40)

    expect(record.history).toHaveLength(1)
  })

  it('adiciona um novo ponto quando o preço da loja ou do keyshop muda', () => {
    files.clear()
    const repo = new JsonPriceHistoryRepository()

    repo.recordObservation(10, 'BRL', 50, 40)
    const record = repo.recordObservation(10, 'BRL', 45, 40)

    expect(record.history).toHaveLength(2)
    expect(record.history[1]).toMatchObject({ retailPrice: 45, keyshopPrice: 40 })
  })

  it('mantém o histórico já existente ao atualizar os menores preços', () => {
    files.clear()
    const repo = new JsonPriceHistoryRepository()

    repo.recordObservation(10, 'BRL', 50, 40)
    const record = repo.recordObservation(10, 'BRL', 30, 40)

    expect(record.lowestRetail).toBe(30)
    expect(record.history).toHaveLength(2)
  })
})
