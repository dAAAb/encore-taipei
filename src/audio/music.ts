import { useClub, type MusicMode } from '@/lib/store'
import { setBeatOrigin } from './beat'
import { engine } from './synth'
import { loadYouTubeApi, TAIPEI_ENCORE_VIDEO_ID, type YTPlayer } from './youtube'

/** Set only once the player is ready: before that the YT.Player object has no playback methods. */
let player: YTPlayer | null = null
let locked = false
let tapped = false

const UNLOCK_EVENTS = ['click', 'touchend', 'keydown', 'pointerup'] as const
/** How long the MV may take to load before the built-in beat takes over. */
const YT_WAIT_MS = 12000
let waitTimer = 0

/** Resume Web Audio without hanging: Safari leaves resume() pending until the page gets a tap. */
const resumeAudio = () => Promise.race([engine.resume().catch(() => {}), new Promise<void>((r) => setTimeout(r, 300))])

/**
 * When the browser refuses to start sound (Safari, or the MV became ready after the tap),
 * keep the MV rolling muted so the beat and picture run, and turn the sound on at the next tap or key.
 */
function lockSound() {
  if (locked || tapped) return
  locked = true
  useClub.getState().setSoundLocked(true)
  if (useClub.getState().musicMode === 'youtube' && player) {
    player.mute()
    player.playVideo()
  }
  const unlock = () => {
    UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlock, true))
    locked = false
    tapped = true
    useClub.getState().setSoundLocked(false)
    engine.resume().catch(() => {})
    const mode = useClub.getState().musicMode
    if (mode === 'youtube' && player) {
      player.unMute()
      player.setVolume(85)
      player.playVideo()
    } else if (mode === 'synth') engine.startMusic()
  }
  UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlock, true))
}

/** The official MV is the default; the built-in beat only takes over when YouTube can't play here. */
function fallBackToSynth() {
  window.clearTimeout(waitTimer)
  const s = useClub.getState()
  const wasYoutube = s.musicMode === 'youtube'
  s.setYoutubeFailed()
  if (!s.started || !wasYoutube) return
  player?.pauseVideo()
  engine.startMusic()
  if (engine.ctx?.state !== 'running') lockSound()
}

/** Create the official-MV player inside `el` ahead of time so the first tap can start it with sound. */
export function mountYouTube(el: HTMLElement) {
  const { setYoutubeReady } = useClub.getState()
  loadYouTubeApi()
    .then((YT) => {
      new YT.Player(el, {
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
          origin: location.origin,
        },
        events: {
          onReady: (e) => {
            player = e.target
            window.clearTimeout(waitTimer)
            setYoutubeReady(true)
            const s = useClub.getState()
            if (s.started && s.wantMusic === 'youtube') {
              applyMusic('youtube').then((m) => useClub.getState().setMusicMode(m))
            }
          },
          onError: (e) => {
            console.warn('YouTube player error', e.data)
            fallBackToSynth()
          },
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
    .catch(() => fallBackToSynth())
}

/** Must run inside a user gesture the first time (autoplay policy). */
export async function applyMusic(mode: MusicMode) {
  const ytReady = useClub.getState().youtubeReady && player
  if (mode === 'youtube' && ytReady) {
    // Before any await: Safari only lets playVideo() start sound while the tap is still being handled.
    engine.stopMusic()
    if (locked) player!.mute()
    else {
      player!.unMute()
      player!.setVolume(85)
    }
    player!.playVideo()
    setTimeout(() => {
      const state = player?.getPlayerState()
      if (useClub.getState().musicMode === 'youtube' && state !== 1 && state !== 3) lockSound()
    }, 2500)
    await resumeAudio()
    return 'youtube' as const
  }
  await resumeAudio()
  if (mode === 'youtube' && !useClub.getState().youtubeFailed) {
    // Still loading: stay on the MV (onReady starts it) rather than flashing the built-in beat first.
    engine.stopMusic()
    window.clearTimeout(waitTimer)
    waitTimer = window.setTimeout(() => {
      if (!useClub.getState().youtubeReady && useClub.getState().musicMode === 'youtube') fallBackToSynth()
    }, YT_WAIT_MS)
    return 'youtube' as const
  }
  player?.pauseVideo()
  if (mode === 'off') {
    engine.stopMusic()
    return 'off' as const
  }
  engine.startMusic()
  if (engine.ctx?.state !== 'running') lockSound()
  return 'synth' as const
}
