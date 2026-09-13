import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface HlsVideoProps {
  src: string
  poster?: string
  className?: string
  autoPlay?: boolean
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

const INITIAL_VOLUME = 0.3

export function HlsVideo({ src, poster, className, autoPlay = false }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = INITIAL_VOLUME

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
      return () => hls.destroy()
    }

    return undefined
  }, [src, autoPlay])

  return <video ref={videoRef} controls preload="metadata" poster={poster} className={className} />
}
