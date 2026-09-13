import type { QueueEntry } from '@shared/types'

/**
 * Registro em memória (não persistido) da ordem de chamadas de uma fila — usado pela tela "Fila de
 * Chamadas" pra mostrar o que tá esperando/rodando agora. Sem histórico: assim que um item termina, ele
 * sai da lista.
 */
export class QueueActivityTracker {
  private entries: QueueEntry[] = []
  private nextId = 1

  enqueue(label: string): number {
    const id = this.nextId++
    this.entries.push({ id, label, status: 'waiting' })
    return id
  }

  markRunning(id: number): void {
    const entry = this.entries.find((item) => item.id === id)
    if (entry) entry.status = 'running'
  }

  finish(id: number): void {
    this.entries = this.entries.filter((item) => item.id !== id)
  }

  getSnapshot(): QueueEntry[] {
    return [...this.entries]
  }
}
