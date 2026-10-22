import { useEffect, useMemo } from 'react'
import { applyMusic, setExternalVolume } from '@/audio/music'
import { engine } from '@/audio/synth'
import { Hud } from '@/components/Hud'
import { StartGate } from '@/components/StartGate'
import { useClub } from '@/lib/store'
import { ClubScene } from '@/scene/ClubScene'

/** Running as channel 2026 inside the Encore TV hub. */
const embedded = window.self !== window.top
const REMOTE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'm', 'M', 'i', 'I'])

function detectWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function App() {
  const started = useClub((s) => s.started)
  const start = useClub((s) => s.start)
  const setMode = useClub((s) => s.setMusicMode)
  const webgl = useMemo(detectWebGL, [])
  const lowPower = useMemo(() => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4, [])

  useEffect(() => {
    if (new URLSearchParams(location.search).has('autostart')) start()
    if (import.meta.env.DEV) Object.assign(window, { __club: useClub })
  }, [start])

  const enter = async () => {
    start()
    const actual = await applyMusic(useClub.getState().musicMode)
    setMode(actual)
    window.setTimeout(() => engine.scream(1), 400)
  }

  useEffect(() => {
    if (!embedded) return
    // The TV already got the visitor's tap; if this browser still blocks audio, the first tap inside resumes it.
    enter()
    const retry = () => applyMusic(useClub.getState().wantMusic).then(setMode)
    window.addEventListener('pointerdown', retry, { once: true })
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; volume?: number; muted?: boolean } | null
      if (d?.type === 'encore:volume') setExternalVolume(d.volume ?? 1, !!d.muted)
    }
    const onKey = (e: KeyboardEvent) => {
      if (REMOTE_KEYS.has(e.key) || /^[0-9]$/.test(e.key)) window.parent.postMessage({ type: 'encore:key', key: e.key }, '*')
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="relative h-full w-full">
      <h1 className="sr-only">台北安可之夜｜蔣萬安黃金十年政見 3D 互動派對 · 2033 台北 AI 園區</h1>
      {webgl && <ClubScene lowPower={lowPower} />}
      <div className="scanlines" />
      <div className="grain" />
      <Hud />
      {!started && !embedded && <StartGate onEnter={enter} webgl={webgl} />}
    </main>
  )
}
