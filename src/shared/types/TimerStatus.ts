export interface TimerStatus {
  key: string
  label: string
  lastRunAt: string | null
  intervalMinutes: number
  running: boolean
}
