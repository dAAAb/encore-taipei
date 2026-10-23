import { Info, Plus, Power, Share2, Upload, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { channelUrl } from '../routing'
import { sfx } from '../sfx'
import { useTv } from '../store'

function Key({
  children,
  onPress,
  label,
  className = '',
}: {
  children: ReactNode
  onPress: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`remote-key flex items-center justify-center ${className}`}
      onClick={() => {
        sfx.click()
        onPress()
      }}
    >
      {children}
    </button>
  )
}

/** Floating TV remote, GTA-phone style: peeks from the corner, slides up when you reach for it. */
export function Remote({ onPowerOff, entry, onDigit }: { onPowerOff: () => void; entry: string; onDigit: (d: number) => void }) {
  const [open, setOpen] = useState(true)
  const touched = useRef(false)
  const step = useTv((s) => s.step)
  const volume = useTv((s) => s.volume)
  const setVolume = useTv((s) => s.setVolume)
  const toggleMute = useTv((s) => s.toggleMute)
  const muted = useTv((s) => s.muted)
  const slot = useTv((s) => s.dial[s.index])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => !touched.current && setOpen(false), 4500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toLastSlot = () => {
    const s = useTv.getState()
    s.tune(s.dial.length - 1)
    if (s.dial[s.dial.length - 1]?.kind === 'empty') window.setTimeout(() => useTv.getState().setSubmitOpen(true), 500)
  }

  const share = async () => {
    if (!slot) return
    const url = channelUrl(slot.number)
    if (navigator.share) await navigator.share({ title: `第 ${slot.number} 台｜台北安可電視台`, url }).catch(() => {})
    else await navigator.clipboard?.writeText(url).catch(() => {})
  }

  return (
    <div
      ref={ref}
      className={`remote-wrap fixed right-3 bottom-0 z-40 sm:right-8 ${open ? 'remote-open' : 'remote-peek'}`}
      onPointerDown={() => (touched.current = true)}
      onClick={() => !open && setOpen(true)}
    >
      <div className="remote-body relative w-[168px] px-4 pt-4 pb-5 sm:w-[184px]">
        <div className="flex items-center justify-between">
          <span className="remote-led" aria-hidden />
          <button
            type="button"
            className="text-[10px] font-black tracking-[0.2em] text-white/45 hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            aria-label={open ? '收起遙控器' : '拿起遙控器'}
          >
            {open ? '收起 ▾' : '遙控器 ▴'}
          </button>
          <Key label="關機" onPress={onPowerOff} className="remote-power size-9 rounded-full">
            <Power className="size-4" />
          </Key>
        </div>

        <div className="remote-lcd mt-3 flex h-9 items-center justify-between px-2.5">
          <span className="text-[10px] font-black tracking-[0.18em] text-[#7dff7a]/70">CH</span>
          <span className="font-mono text-lg font-bold tracking-wider text-[#b6ffb0]">{entry ? entry.padEnd(4, '_') : slot?.number}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <Key key={d} label={`數字 ${d}`} onPress={() => onDigit(d)} className="h-8 rounded-full text-sm font-bold">
              {d}
            </Key>
          ))}
          <Key label="頻道資訊" onPress={() => useTv.getState().setInfoOpen(!useTv.getState().infoOpen)} className="h-8 rounded-full">
            <Info className="size-4" />
          </Key>
          <Key label="數字 0" onPress={() => onDigit(0)} className="h-8 rounded-full text-sm font-bold">
            0
          </Key>
          <Key label="上架你的舞台" onPress={toLastSlot} className="h-8 rounded-full text-[#ffd400]">
            <Upload className="size-4" />
          </Key>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="remote-rocker flex flex-col items-center">
            <Key label="下一台" onPress={() => step(1)} className="h-11 w-full rounded-t-[22px] text-lg">
              ▲
            </Key>
            <span className="py-1 text-[10px] font-black tracking-[0.2em] text-white/55">CH</span>
            <Key label="上一台" onPress={() => step(-1)} className="h-11 w-full rounded-b-[22px] text-lg">
              ▼
            </Key>
          </div>
          <div className="remote-rocker flex flex-col items-center">
            <Key label="大聲一點" onPress={() => setVolume(volume + 5)} className="h-11 w-full rounded-t-[22px]">
              <Plus className="size-5" />
            </Key>
            <span className="py-1 text-[10px] font-black tracking-[0.2em] text-white/55">VOL</span>
            <Key label="小聲一點" onPress={() => setVolume(volume - 5)} className="h-11 w-full rounded-b-[22px] text-2xl leading-none">
              −
            </Key>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Key label={muted ? '取消靜音' : '靜音'} onPress={toggleMute} className={`h-8 rounded-full ${muted ? 'text-[#ff5a6e]' : ''}`}>
            <VolumeX className="size-4" />
          </Key>
          <Key label="分享這一台" onPress={share} className="h-8 rounded-full">
            <Share2 className="size-4" />
          </Key>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5" aria-label="彩色鍵">
          {(
            [
              ['red', '#e2363f', '紅色鍵（第 2026 台：市長獨舞）'],
              ['green', '#2fbf55', '綠色鍵（第 2026 台：換一批伴舞）'],
              ['yellow', '#f2c21b', '黃色鍵'],
              ['blue', '#2f7bff', '藍色鍵'],
            ] as const
          ).map(([color, hex, label]) => (
            <Key key={color} label={label} onPress={() => window.dispatchEvent(new CustomEvent('encore:color', { detail: color }))} className="h-3.5 rounded-sm">
              <span className="block h-1.5 w-full rounded-[2px]" style={{ background: hex }} />
            </Key>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] font-black tracking-[0.35em] text-white/35">ENCORE</p>
        <p className="mt-1 hidden text-center text-[10px] leading-snug text-white/35 sm:block">鍵盤 ← → 轉台 · + − 音量 · M 靜音 · I 資訊</p>
      </div>
    </div>
  )
}
