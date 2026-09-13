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

  it('isRunning() reflete a execução automática do agendamento, não só chamadas manuais (runNow)', async () => {
    let resolveTick!: () => void
    const onTick = vi.fn(() => new Promise<void>((resolve) => (resolveTick = resolve)))
    const repository = makeFakePollingStateRepository(null)
    const scheduler = new LastRunScheduler('Teste', onTick, repository, makeFakeSessionLogRepository(), 60)

    expect(scheduler.isRunning()).toBe(false)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(scheduler.isRunning()).toBe(true)

    resolveTick()
    await vi.advanceTimersByTimeAsync(0)

    expect(scheduler.isRunning()).toBe(false)
  })

  it('expõe label, último timestamp e intervalo pra tela de status', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const repository = makeFakePollingStateRepository(null)
    const scheduler = new LastRunScheduler(
      'Sincronização da Biblioteca',
      onTick,
      repository,
      makeFakeSessionLogRepository(),
      30
    )

    expect(scheduler.getLabel()).toBe('Sincronização da Biblioteca')
    expect(scheduler.getIntervalMinutes()).toBe(30)
    expect(scheduler.getLastRunAt()).toBeNull()

    scheduler.notifyExternalRun()

    expect(scheduler.getLastRunAt()).toBe(repository.getLastRunAt())
  })

  it('setIntervalMinutes reseta lastRunAt — o próximo tick espera o intervalo novo inteiro, não o resto do antigo', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    // Com lastRunAt de 40min atrás e intervalo de 60min, faltariam só uns 20min pro próximo tick — se
    // setIntervalMinutes(30) NÃO resetasse lastRunAt, os 40min já decorridos estourariam o novo
    // intervalo de 30min na hora (dispararia quase imediatamente, bem antes da marca de 29min abaixo).
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString()
    const repository = makeFakePollingStateRepository(fortyMinutesAgo)
    const scheduler = new LastRunScheduler('Teste', onTick, repository, makeFakeSessionLogRepository(), 60)

    scheduler.start()
    scheduler.setIntervalMinutes(30)

    expect(scheduler.getIntervalMinutes()).toBe(30)

    await vi.advanceTimersByTimeAsync(29 * 60 * 1000)
    expect(onTick).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('setInitialIntervalMinutes não mexe em lastRunAt nem reagenda (uso só na montagem inicial)', () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const initialLastRunAt = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const repository = makeFakePollingStateRepository(initialLastRunAt)
    const scheduler = new LastRunScheduler('Teste', onTick, repository, makeFakeSessionLogRepository(), 60)

    scheduler.setInitialIntervalMinutes(65)

    expect(repository.getLastRunAt()).toBe(initialLastRunAt)
    expect(scheduler.getIntervalMinutes()).toBe(65)
    expect(onTick).not.toHaveBeenCalled()
  })
})
