import { describe, expect, it } from 'vitest'
import { extractM3u8References } from './hlsManifest'

describe('extractM3u8References', () => {
  it('extrai a faixa de áudio e todas as variantes de vídeo do manifest master (formato real da Steam)', () => {
    const master = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Default",AUTOSELECT=YES,DEFAULT=YES,URI="hls_264_4_audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=5800000,CODECS="avc1.640029,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=30,AUDIO="audio"
hls_264_0_video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2600000,CODECS="avc1.640029,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=30,AUDIO="audio"
hls_264_1_video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,CODECS="avc1.640029,mp4a.40.2",RESOLUTION=854x480,FRAME-RATE=30,AUDIO="audio"
hls_264_2_video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,CODECS="avc1.640029,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=30,AUDIO="audio"
hls_264_3_video.m3u8`

    expect(extractM3u8References(master)).toEqual([
      'hls_264_4_audio.m3u8',
      'hls_264_0_video.m3u8',
      'hls_264_1_video.m3u8',
      'hls_264_2_video.m3u8',
      'hls_264_3_video.m3u8'
    ])
  })

  it('extrai o segmento de inicialização e todos os chunks de um sub-manifest de vídeo/áudio', () => {
    const subManifest = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="dash_h264/init-stream1.m4s"
#EXTINF:3
dash_h264/chunk-stream1-00001.m4s
#EXTINF:3
dash_h264/chunk-stream1-00002.m4s
#EXT-X-ENDLIST`

    expect(extractM3u8References(subManifest)).toEqual([
      'dash_h264/init-stream1.m4s',
      'dash_h264/chunk-stream1-00001.m4s',
      'dash_h264/chunk-stream1-00002.m4s'
    ])
  })

  it('ignora linhas de comentário sem URI e linhas em branco', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:7

#EXT-X-ENDLIST`

    expect(extractM3u8References(manifest)).toEqual([])
  })
})
