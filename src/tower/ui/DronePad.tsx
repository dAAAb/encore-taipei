import { ArrowDown, ArrowUp, Minus, Plus, PlaneLanding, Trees } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { sfx } from '@/tv/sfx'
import { floorTitle, type Floor } from '../layout'
import { rig } from '../scene/rigState'
import { useTower } from '../store'

/** Holding a repeating key: the first step right away, then one more every REPEAT_MS after HOLD_MS. */
const HOLD_MS = 380
const REPEAT_MS = 170

function Key({
  label,
  onPress,
  children,
  className = '',
  disabled,
  repeat,
}: {
  label: string
  onPress: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  repeat?: boolean
}) {
  const press = useRef(onPress)
  press.current = onPress
  const timer = useRef(0)
  const byPointer = useRef(false)
  const stop = () => {
    window.clearTimeout(timer.current)
    timer.current = 0
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])

  return (
    <button
      type="button"
      aria-label={label}
      title={repeat ? `${label}（按住不放可以一直飛）` : label}
      disabled={disabled}
      className={`pad-key ${className}`}
      onPointerDown={(e) => {
        if (!repeat || e.button !== 0) return
        byPointer.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        sfx.click()
        press.current()
        const tick = () => {
          press.current()
          timer.current = window.setTimeout(tick, REPEAT_MS)
        }
        stop()
        timer.current = window.setTimeout(tick, HOLD_MS)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => repeat && e.preventDefault()}
      onClick={() => {
        // Pointer presses already stepped on pointerdown; this is the keyboard (Enter/Space) path.
        if (byPointer.current) {
          byPointer.current = false
          return
        }
        sfx.click()
        press.current()
      }}
    >
      {children}
    </button>
  )
}

/** The drone remote: which floor we're facing, up/down, nearer/farther, and the button to fly in. */
export function DronePad({ floors, onEnter }: { floors: Floor[]; onEnter: (f: Floor) => void }) {
  const target = useTower((s) => s.target)
  const zoom = useTower((s) => s.zoom)
  const n = floors.length
  const at = Math.max(0, Math.min(n, Math.round(target)))
  const roof = at >= n
  const floor = roof ? null : floors[at]
  const go = (t: number) => {
    rig.lastInput = performance.now()
    useTower.getState().setTarget(Math.max(0, Math.min(n, t)))
  }
  // Read the store, not this render's values, so a held key keeps climbing.
  const step = (d: number) => go(Math.max(0, Math.min(n, Math.round(useTower.getState().target))) + d)
  const nearer = (d: number) => useTower.getState().setZoom(useTower.getState().zoom + d)

  return (
    <div className="drone-pad fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 w-[min(300px,calc(100vw-24px))] p-3 text-white select-none sm:right-4">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-[#0c0812] bg-[#0b0a10] px-3 py-2">
        <span className="elevator-digits min-w-[4.6rem]">{roof ? 'R' : `${floor!.number}F`}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#fff4d6]">{roof ? '頂樓花園・聊天室' : floorTitle(floor!)}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          <Key label="往上飛一層" onPress={() => step(1)} disabled={roof} repeat className="h-11 touch-none">
            <ArrowUp className="size-5" />
          </Key>
          <Key label="飛近一點" onPress={() => nearer(-0.15)} disabled={zoom <= 0} repeat className="h-11 touch-none">
            <Plus className="size-5" />
          </Key>
          <Key label="飛到頂樓花園" onPress={() => go(n)} className="h-11">
            <Trees className="size-5" />
          </Key>
          <Key label="往下飛一層" onPress={() => step(-1)} disabled={at <= 0} repeat className="h-11 touch-none">
            <ArrowDown className="size-5" />
          </Key>
          <Key label="飛遠一點" onPress={() => nearer(0.15)} disabled={zoom >= 1} repeat className="h-11 touch-none">
            <Minus className="size-5" />
          </Key>
          <Key label="回到最底層" onPress={() => go(0)} className="h-11">
            <PlaneLanding className="size-5" />
          </Key>
        </div>
        <button
          type="button"
          disabled={roof}
          onClick={() => floor && onEnter(floor)}
          className="ink-btn flex w-[5.2rem] flex-col items-center justify-center gap-0.5 px-2 text-sm leading-tight disabled:opacity-40"
          data-on="true"
        >
          <span className="text-lg">▶</span>
          飛進
          <span className="text-[11px]">這一層</span>
        </button>
      </div>
      <p className="mt-2 hidden text-center text-[11px] leading-snug text-white/55 sm:block">按住 ↑↓ 一直飛・滾輪或上下拖曳也可以・左右拖曳繞一圈・點樓層飛進去</p>
      <p className="mt-2 text-center text-[11px] leading-snug text-white/55 sm:hidden">按住 ↑↓ 一直飛・上下滑也可以・雙指：遠近・點樓層飛進去</p>
    </div>
  )
}
