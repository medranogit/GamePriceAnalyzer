import { logger } from '../logging/logger'

const RETRY_DELAYS_MS = [500, 1500]

/**
 * Reexecuta em falhas de rede (timeout, DNS, conexão recusada) — não em
 * respostas HTTP de erro (4xx/5xx), que quem chama decide como tratar.
 */
export async function fetchWithRetry(url: string | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetch(url, init)
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      logger.warn(`Falha de rede em ${url}, tentando de novo em ${delay}ms`, error)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
