import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { logger } from '../logging/logger'

/**
 * Persistência simples em JSON no diretório userData. Substitui electron-store
 * (que na v10 é ESM-only e conflita com o bundle do main process) por algo
 * mínimo e sem dependências, já que só precisamos ler/gravar um objeto inteiro.
 */
export class JsonFileStore<T> {
  private readonly filePath: string
  private cache: T

  constructor(fileName: string, defaults: T) {
    this.filePath = join(app.getPath('userData'), fileName)
    this.cache = this.loadFromDisk(defaults)
  }

  read(): T {
    return this.cache
  }

  write(data: T): void {
    this.cache = data
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(data, null, 2))
    } catch (error) {
      logger.error(`Falha ao gravar ${this.filePath}`, error)
    }
  }

  private loadFromDisk(defaults: T): T {
    if (!existsSync(this.filePath)) return defaults
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as T
      return { ...defaults, ...parsed }
    } catch (error) {
      logger.error(`Falha ao ler ${this.filePath}, usando valores padrão.`, error)
      return defaults
    }
  }
}
