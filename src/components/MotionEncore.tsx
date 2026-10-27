import { Sparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { clearHint, fx, HINTS, press, shake, showHint, useEncore } from '@/lib/encore'
import { listenMotion, listenPointerShake } from '@/lib/motion'

export function EncoreButton() {
  const mode = useEncore((s) => s.mode)
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="ink-btn encore-btn flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm"
        data-on={mode !== 'off'}
        onClick={press}
        title={mode === 'off' ? '體感安可：放彩帶，搖手機或甩滑鼠還能改變飄落方向' : '再放一輪彩帶'}
      >
        <Sparkles className="size-3.5" /> 體感安可
      </button>
      {mode !== 'off' && (
        <button
          type="button"
          className="ink-btn flex size-7 items-center justify-center p-0"
          aria-label="關閉體感安可"
          title="關閉體感安可"
          onClick={() => {
            clearHint()
            useEncore.setState({ mode: 'off', hint: null })
            fx.tilt(null)
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function EncoreHint() {
  const hint = useEncore((s) => s.hint)
  if (!hint) return null
  return (
    <p className="ink-card slide-up w-[min(320px,calc(100vw-24px))] px-3 py-2 text-xs leading-relaxed font-bold" role="status">
      <span className="mr-1 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-1.5 text-[10px] font-black">體感安可</span>
      {hint}
    </p>
  )
}

/** The canvas the confetti flies on, plus the sensors while 體感安可 is on. */
export function EncoreLayer() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const mode = useEncore((s) => s.mode)

  useEffect(() => fx.attach(canvas.current!), [])

  useEffect(() => listenPointerShake({ onShake: (d, s) => useEncore.getState().mode !== 'off' && shake(d, s), onSweep: (v) => fx.sweep(v) }), [])

  useEffect(() => {
    if (mode !== 'motion') return
    let heard = false
    return listenMotion({
      onTilt: (g) => {
        if (!heard) showHint(HINTS.motion)
        heard = true
        fx.tilt(g)
      },
      onShake: shake,
      onSilent: () => {
        useEncore.setState({ mode: 'pointer' })
        showHint(HINTS.pointer)
      },
    })
  }, [mode])

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[15] h-full w-full" aria-hidden />
}
