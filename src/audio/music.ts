import { useClub, type MusicMode } from '@/lib/store'
import { setBeatOrigin } from './beat'
import { engine } from './synth'
import { loadYouTubeApi, TAIPEI_ENCORE_VIDEO_ID, type YTPlayer } from './youtube'

let player: YTPlayer | null = null

/** Create the official-MV player inside `el` ahead of time so the first tap can start it with sound. */
export function mountYouTube(el: HTMLElement) {
  const { setYoutubeReady, setYoutubeFailed } = useClub.getState()
  loadYouTubeApi()
    .then((YT) => {
      player = new YT.Player(el, {
        videoId: TAIPEI_ENCORE_VIDEO_ID,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: TAIPEI_ENCORE_VIDEO_ID,
        },
        events: {
          onReady: () => setYoutubeReady(true),
          onError: () => setYoutubeFailed(),
          onStateChange: (e) => {
            if (e.data === 0) {
              e.target.seekTo(0, true)
              e.target.playVideo()
            }
            if (e.data === 1) setBeatOrigin(performance.now() / 1000)
          },
        },
      })
    })
    .catch(() => setYoutubeFailed())
}

/** Must run inside a user gesture the first time (autoplay policy). */
export async function applyMusic(mode: MusicMode) {
  await engine.resume().catch(() => {})
  const ytReady = useClub.getState().youtubeReady && player
  if (mode === 'youtube' && ytReady) {
    engine.stopMusic()
    player!.unMute()
    player!.setVolume(85)
    player!.playVideo()
    return 'youtube' as const
  }
  player?.pauseVideo()
  if (mode === 'off') {
    engine.stopMusic()
    return 'off' as const
  }
  engine.startMusic()
  return 'synth' as const
}
