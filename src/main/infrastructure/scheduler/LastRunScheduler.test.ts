import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PollingStateRepository } from '../../domain/repositories/PollingStateRepository'
import type { SessionLogRepository } from '../../domain/repositories/SessionLogRepository'
import { LastRunScheduler } from './LastRunScheduler'

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

function makeFakeSessionLogRepository(): SessionLogRepository {
  return {
    startSession: vi.fn(() => 'session-id'),
    log: vi.fn(),
    endSession: vi.fn(),
    listSessions: () => [],
    getEntries: () => [],
    deleteSession: vi.fn()
  }
}

describe('LastRunScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('notifyExternalRun registra a execução e adia a próxima automática, sem chamar onTick', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const repository = makeFakePollingStateRepository(null)
    const scheduler = new LastRunScheduler('Teste', onTick, repository, makeFakeSessionLogRepository(), 60)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onTick).toHaveBeenCalledTimes(1)

    scheduler.notifyExternalRun()
    expect(repository.getLastRunAt()).not.toBeNull()

    await vi.advanceTimersByTimeAsync(59 * 60 * 1000)
    expect(onTick).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('logStatus registra quanto falta pra próxima execução sem mexer no agendamento', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const repository = makeFakePollingStateRepository(new Date().toISOString())
    const sessionLogRepository = makeFakeSessionLogRepository()
    const scheduler = new LastRunScheduler('Busca de ofertas', onTick, repository, sessionLogRepository, 60)

    scheduler.start()
    vi.mocked(sessionLogRepository.log).mockClear()

    scheduler.logStatus()

    expect(sessionLogRepository.log).toHaveBeenCalledWith(
      'info',
      expect.stringMatching(/^Busca de ofertas \(60\): próxima em \d+ min$/)
    )

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })
})
