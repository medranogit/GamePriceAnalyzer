export interface QueueEntry {
  id: number
  label: string
  status: 'waiting' | 'running'
}
