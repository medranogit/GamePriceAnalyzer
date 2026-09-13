import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface HlsVideoProps {
  src: string
  poster?: string
  className?: string
}

export function HlsVideo({ src, poster, className }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!src.endsWith('.m3u8')) {
      video.src = src
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => hls.destroy()
    }

    return undefined
  }, [src])

  return <video ref={videoRef} controls preload="metadata" poster={poster} className={className} />
}
