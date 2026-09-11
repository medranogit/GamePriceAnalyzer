import { afterEach, describe, expect, it, vi } from 'vitest'
import { PollingScheduler } from './PollingScheduler'

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('PollingScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('não deixa uma chamada manual (runNow) rodar em paralelo com uma busca automática já em andamento', async () => {
    let resolveFirstTick: () => void = () => {}
    const firstTick = new Promise<void>((resolve) => {
      resolveFirstTick = resolve
    })
    const onTick = vi.fn().mockReturnValueOnce(firstTick).mockReturnValue(Promise.resolve())

    vi.useFakeTimers()
    const scheduler = new PollingScheduler(onTick)
    scheduler.start(30) // dispara a primeira busca (automática) imediatamente, ainda pendente

    const manualRun = scheduler.runNow()
    resolveFirstTick()
    await manualRun

    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('permite rodar de novo depois que a busca anterior termina', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick)

    await scheduler.runNow()
    await scheduler.runNow()

    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('erro numa busca não trava buscas futuras', async () => {
    const onTick = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(undefined)
    const scheduler = new PollingScheduler(onTick)

    await scheduler.runNow()
    await scheduler.runNow()

    expect(onTick).toHaveBeenCalledTimes(2)
  })
})
