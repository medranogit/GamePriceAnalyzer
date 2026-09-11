/**
 * Som de alerta sintetizado via Web Audio API (dois tons suaves) — evita
 * depender de um arquivo de áudio embutido no bundle.
 */
export function playAlertSound(): void {
  const ctx = new AudioContext()
  const now = ctx.currentTime

  const playTone = (freq: number, start: number, duration: number): void => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02)
    gain.gain.linearRampToValueAtTime(0, now + start + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now + start)
    oscillator.stop(now + start + duration)
  }

  playTone(660, 0, 0.15)
  playTone(880, 0.15, 0.25)

  setTimeout(() => ctx.close(), 600)
}
