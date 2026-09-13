import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { useSettings } from '@renderer/hooks/useSettings'

interface HlsVideoProps {
  src: string
  poster?: string
  className?: string
  autoPlay?: boolean
  /** Chamado quando o vídeo não consegue carregar depois de esgotar as tentativas automáticas (ex:
   * arquivo local apagado da pasta de mídia) — tanto pra um `<video src>` direto quanto pra uma falha
   * fatal do hls.js. */
  onError?: () => void
}

// As URLs de hls_h264 da Steam sempre vêm com uma query string de cache-busting
// (`...master.m3u8?t=123`) — `src.endsWith('.m3u8')` direto sempre dava falso e
// tratava o manifest HLS como vídeo comum, que o Chromium não sabe tocar.
function isHlsManifestUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('.m3u8')
  } catch {
    return url.split('?')[0].endsWith('.m3u8')
  }
}

const DEFAULT_INITIAL_VOLUME_PERCENT = 30
const MAX_LOAD_RETRIES = 3
const RETRY_DELAY_MS = 700

export function HlsVideo({ src, poster, className, autoPlay = false, onError }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { data: settings } = useSettings()
  const initialVolume = (settings?.defaultVideoVolumePercent ?? DEFAULT_INITIAL_VOLUME_PERCENT) / 100

  // Um arquivo local recém-baixado às vezes não está pronto pra leitura na hora (ex: antivírus
  // escaneando o arquivo assim que é criado) — tenta de novo algumas vezes com um pequeno atraso antes
  // de desistir e avisar `onError` (que aí sim assume que o arquivo realmente sumiu).
  const retriesRef = useRef(0)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    retriesRef.current = 0
    setRetryTick(0)
  }, [src])

  const handleLoadFailure = (): void => {
    if (retriesRef.current < MAX_LOAD_RETRIES) {
      retriesRef.current += 1
      setTimeout(() => setRetryTick((tick) => tick + 1), RETRY_DELAY_MS)
    } else {
      onError?.()
    }
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = initialVolume
  }, [initialVolume])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!isHlsManifestUrl(src)) {
      video.src = src
      if (autoPlay) void video.play().catch(() => {})
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      if (autoPlay) void video.play().catch(() => {})
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
      if (autoPlay) {
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {})
        })
      }
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) handleLoadFailure()
      })
      return () => hls.destroy()
    }

    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryTick só serve pra forçar reexecução
  }, [src, autoPlay, retryTick])

  return (
    <video
      ref={videoRef}
      controls
      preload="metadata"
      poster={poster}
      className={className}
      onError={handleLoadFailure}
    />
  )
}
