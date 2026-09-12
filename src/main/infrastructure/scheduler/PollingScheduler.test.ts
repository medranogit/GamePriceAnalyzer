import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'
import { PollingScheduler } from './PollingScheduler'

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

function makeFakePollingStateRepository(initialLastRunAt: string | null = null): PollingStateRepository {
  let lastRunAt = initialLastRunAt
  return {
    getLastRunAt: () => lastRunAt,
    setLastRunAt: (iso: string) => {
      lastRunAt = iso
    }
  }
}

describe('PollingScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara a busca imediatamente quando nunca rodou antes', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(null))

    scheduler.start(65)
    await vi.advanceTimersByTimeAsync(0)

    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('não dispara imediatamente se o intervalo desde a última execução ainda não passou', async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const onTick = vi.fn().mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(twoMinutesAgo))

    scheduler.start(65)
    await vi.advanceTimersByTimeAsync(0)
    expect(onTick).not.toHaveBeenCalled()

    // faltam ~63 min pro intervalo de 65 completar desde a última execução
    await vi.advanceTimersByTimeAsync(63 * 60 * 1000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('dispara imediatamente se já passou do intervalo desde a última execução', async () => {
    const seventyMinutesAgo = new Date(Date.now() - 70 * 60 * 1000).toISOString()
    const onTick = vi.fn().mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(seventyMinutesAgo))

    scheduler.start(65)
    await vi.advanceTimersByTimeAsync(0)

    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('runNow roda na hora e empurra a próxima busca automática pra depois dela', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(null))

    scheduler.start(65)
    await vi.advanceTimersByTimeAsync(0)
    expect(onTick).toHaveBeenCalledTimes(1)

    await scheduler.runNow()
    expect(onTick).toHaveBeenCalledTimes(2)

    // logo em seguida não deve haver outra busca agendada pra já
    await vi.advanceTimersByTimeAsync(1000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('não deixa uma chamada manual (runNow) rodar em paralelo com uma busca automática já em andamento', async () => {
    let resolveFirstTick: () => void = () => {}
    const firstTick = new Promise<void>((resolve) => {
      resolveFirstTick = resolve
    })
    const onTick = vi.fn().mockReturnValueOnce(firstTick).mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(null))

    scheduler.start(65)
    await vi.advanceTimersByTimeAsync(0) // dispara a primeira busca (automática), ainda pendente

    const manualRun = scheduler.runNow()
    resolveFirstTick()
    await manualRun

    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('erro numa busca não trava buscas futuras', async () => {
    const onTick = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick, makeFakePollingStateRepository(null))

    await scheduler.runNow()
    await scheduler.runNow()

    expect(onTick).toHaveBeenCalledTimes(2)
  })
})
