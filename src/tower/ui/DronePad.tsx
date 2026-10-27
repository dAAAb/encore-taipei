import { ArrowDown, ArrowUp, Minus, Plus, PlaneLanding, Trees } from 'lucide-react'
import { sfx } from '@/tv/sfx'
import { floorTitle, type Floor } from '../layout'
import { rig } from '../scene/rigState'
import { useTower } from '../store'

function Key({ label, onPress, children, className = '', disabled }: { label: string; onPress: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`pad-key ${className}`}
      onClick={() => {
        sfx.click()
        onPress()
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

  return (
    <div className="drone-pad fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 w-[min(300px,calc(100vw-24px))] p-3 text-white select-none sm:right-4">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-[#0c0812] bg-[#0b0a10] px-3 py-2">
        <span className="elevator-digits min-w-[4.6rem]">{roof ? 'R' : `${floor!.number}F`}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#fff4d6]">{roof ? '頂樓花園・聊天室' : floorTitle(floor!)}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          <Key label="往上飛一層" onPress={() => go(at + 1)} disabled={roof} className="h-11">
            <ArrowUp className="size-5" />
          </Key>
          <Key label="飛近一點" onPress={() => useTower.getState().setZoom(zoom - 0.2)} disabled={zoom <= 0} className="h-11">
            <Plus className="size-5" />
          </Key>
          <Key label="飛到頂樓花園" onPress={() => go(n)} className="h-11">
            <Trees className="size-5" />
          </Key>
          <Key label="往下飛一層" onPress={() => go(at - 1)} disabled={at <= 0} className="h-11">
            <ArrowDown className="size-5" />
          </Key>
          <Key label="飛遠一點" onPress={() => useTower.getState().setZoom(zoom + 0.2)} disabled={zoom >= 1} className="h-11">
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
      <p className="mt-2 hidden text-center text-[11px] leading-snug text-white/55 sm:block">滾輪或上下拖曳：上下飛・左右拖曳：繞一圈・點樓層飛進去</p>
      <p className="mt-2 text-center text-[11px] leading-snug text-white/55 sm:hidden">上下滑：上下飛・雙指：遠近・點樓層飛進去</p>
    </div>
  )
}
