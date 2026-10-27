import { useEffect, useRef, useState } from 'react'
import { engine } from '@/audio/synth'
import { loadYouTubeApi, TAIPEI_ENCORE_VIDEO_ID, type YTPlayer } from '@/audio/youtube'
import { sfx } from '../sfx'
import { useTv } from '../store'
import { Credits } from './Credits'
import { FinaleScene } from './FinaleScene'
import { Slit } from './Slit'

const CREDITS_SECONDS = 72

type Stage = 'show' | 'credits' | 'slit' | 'through'

/**
 * Power-off finale. The 3D scene runs the launch; this layer adds the cloud whiteout, the song and
 * credits, and the white slit that leads back into the room.
 */
export default function Finale({ onDone, lowPower }: { onDone: () => void; lowPower: boolean }) {
  const [stage, setStage] = useState<Stage>('show')
  const [flash, setFlash] = useState(0)
  const [mvVisible, setMvVisible] = useState(false)
  const mvEl = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const synthOn = useRef(false)
  const volume = useTv((s) => s.volume)
  const muted = useTv((s) => s.muted)

  useEffect(() => {
    let alive = true
    loadYouTubeApi()
      .then((YT) => {
        if (!alive || !mvEl.current) return
        player.current = new YT.Player(mvEl.current, {
          videoId: TAIPEI_ENCORE_VIDEO_ID,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1, origin: location.origin },
          events: { onError: () => (player.current = null) },
        })
      })
      .catch(() => {})
    return () => {
      alive = false
      player.current?.destroy()
      if (synthOn.current) engine.stopMusic()
    }
  }, [])

  useEffect(() => {
    const p = player.current
    const level = muted ? 0 : volume
    if (p) {
      try {
        p.setVolume(level)
      } catch {
        /* player not ready yet */
      }
    }
    engine.setOutput(level / 100)
  }, [volume, muted, stage])

  const startMusic = () => {
    const p = player.current
    try {
      if (!p) throw new Error('no player')
      p.unMute()
      p.setVolume(muted ? 0 : volume)
      p.playVideo()
      setMvVisible(true)
    } catch {
      synthOn.current = true
      engine.resume().then(() => engine.startMusic())
    }
  }

  const gone = useRef(false)
  const through = () => {
    if (stage !== 'slit' || gone.current) return
    gone.current = true
    setStage('through')
    sfx.whoosh(1.1, true, 0.8)
    sfx.ting()
    try {
      player.current?.pauseVideo()
    } catch {
      /* already gone */
    }
    if (synthOn.current) engine.stopMusic()
    window.setTimeout(onDone, 1100)
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <FinaleScene
        lowPower={lowPower}
        onCloud={() => {
          setFlash((f) => f + 1)
        }}
        onCredits={() => {
          setStage('credits')
          startMusic()
        }}
      />

      {flash > 0 && <div key={flash} className="flash-white pointer-events-none fixed inset-0 z-50 bg-white" />}

      <div
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-50 w-[min(46vw,240px)] overflow-hidden rounded-lg border-2 border-white/20 bg-black shadow-2xl transition-opacity duration-700 ${mvVisible && stage !== 'through' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <p className="bg-black/80 px-2 py-1 text-[11px] font-bold text-white/80">正在播放〈台北安可〉官方 MV</p>
        <div className="aspect-video">
          <div ref={mvEl} className="h-full w-full" />
        </div>
      </div>

      {stage === 'credits' && <Credits duration={CREDITS_SECONDS} onEnd={() => setStage('slit')} />}

      {(stage === 'slit' || stage === 'through') && <Slit opening={stage === 'through'} onEnter={through} />}

      {stage === 'show' || stage === 'credits' ? (
        <button
          type="button"
          className="tv-caption fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-sm text-white/80 backdrop-blur hover:bg-black/60"
          onClick={(e) => {
            e.stopPropagation()
            setStage('slit')
            if (stage === 'show') startMusic()
          }}
        >
          略過片尾 ▶▶
        </button>
      ) : null}
    </div>
  )
}
