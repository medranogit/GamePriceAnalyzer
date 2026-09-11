import { safeStorage, app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../logging/logger'

const SECRETS_DIR = () => join(app.getPath('userData'), 'secrets')
const SECRETS_FILE = () => join(SECRETS_DIR(), 'keys.enc')

type SecretKey = 'steamApiKey' | 'ggDealsApiKey'
type SecretsMap = Partial<Record<SecretKey, string>>

/**
 * Guarda chaves de API criptografadas em disco via Electron safeStorage
 * (DPAPI no Windows). Usado pela tela de Configurações; em dev, os valores
 * de .env são usados como fallback inicial na primeira execução.
 */
export class SecretsStore {
  private cache: SecretsMap | null = null

  private readAll(): SecretsMap {
    if (this.cache) return this.cache
    if (!existsSync(SECRETS_FILE())) {
      this.cache = {}
      return this.cache
    }
    try {
      const encrypted = readFileSync(SECRETS_FILE())
      const decrypted = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(encrypted)
        : encrypted.toString('utf-8')
      this.cache = JSON.parse(decrypted) as SecretsMap
    } catch (error) {
      logger.error('Falha ao ler secrets store, resetando.', error)
      this.cache = {}
    }
    return this.cache
  }

  private writeAll(secrets: SecretsMap): void {
    mkdirSync(SECRETS_DIR(), { recursive: true })
    const json = JSON.stringify(secrets)
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf-8')
    writeFileSync(SECRETS_FILE(), payload)
    this.cache = secrets
  }

  get(key: SecretKey): string | null {
    return this.readAll()[key] ?? process.env[this.envVarName(key)] ?? null
  }

  set(key: SecretKey, value: string): void {
    const secrets = this.readAll()
    secrets[key] = value
    this.writeAll(secrets)
  }

  private envVarName(key: SecretKey): string {
    return key === 'steamApiKey' ? 'STEAM_API_KEY' : 'GG_DEALS_API_KEY'
  }
}
