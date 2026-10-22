import { useEffect, useMemo } from 'react'
import { applyMusic } from '@/audio/music'
import { engine } from '@/audio/synth'
import { Hud } from '@/components/Hud'
import { StartGate } from '@/components/StartGate'
import { useClub } from '@/lib/store'
import { ClubScene } from '@/scene/ClubScene'

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
  }, [start])

  const enter = async () => {
    start()
    const actual = await applyMusic(useClub.getState().musicMode)
    setMode(actual)
    window.setTimeout(() => engine.scream(1), 400)
  }

  return (
    <main className="relative h-full w-full">
      <h1 className="sr-only">來生 AFTERLIFE · 2033 台北 AI 園區 · 蔣萬安台北安可之夜</h1>
      {webgl && <ClubScene lowPower={lowPower} />}
      <div className="scanlines" />
      <div className="grain" />
      <Hud />
      {!started && <StartGate onEnter={enter} webgl={webgl} />}
    </main>
  )
}
