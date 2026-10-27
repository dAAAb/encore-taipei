import { ChevronDown, ChevronUp, Info, LayoutGrid, Plus, Power, Share2, Upload, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { track } from '@/lib/analytics'
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

/** The bottom row: a sound on red, then the three Duo layouts (each reloads this channel with its flag). */
const COLOR_KEYS = [
  { color: 'red', hex: '#e2363f', emoji: '5️⃣', caption: '音效', action: 'five', label: '5️⃣ 播放音效' },
  { color: 'green', hex: '#2fbf55', emoji: '📱', caption: 'Duo', action: 'duo', label: '📱 Duo 模式：一支手機，上半電視、下半遙控器' },
  { color: 'yellow', hex: '#f2c21b', emoji: '📺', caption: '電視', action: 'tv', label: '📺 電視模式：讓另一支手機配對成遙控器' },
  { color: 'blue', hex: '#2f7bff', emoji: '🕹️', caption: '遙控器', action: 'remote', label: '🕹️ 遙控器模式：配對另一台電視' },
] as const

const FIVE_SOUND = `${import.meta.env.BASE_URL}remote/five.wav`
let five: HTMLAudioElement | null = null

function playFive(volume: number) {
  five ??= new Audio(FIVE_SOUND)
  five.volume = Math.max(0, Math.min(1, volume))
  five.currentTime = 0
  five.play().catch(() => {})
}

const TOP_GAP = 12
const LIFT = 14
const PEEK = 92
const MIN_PEEK = 58
const SWIPE = 36

/** Shrinks the remote until all of it, collapse handle included, fits the visible screen. */
function useFitScale(body: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const fit = () => {
      const vv = window.visualViewport
      const vh = vv?.height ?? window.innerHeight
      const vw = vv?.width ?? window.innerWidth
      const base = vw <= 640 ? 0.82 : 1
      const room = (vh - TOP_GAP - LIFT) / el.offsetHeight
      setScale(Math.max(0.42, Math.min(base, room)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
    }
  }, [body])
  return scale
}

/**
 * Floating TV remote, GTA-phone style: peeks from the corner, slides up when you reach for it.
 * Putting it down: the handle on top, a swipe down, a tap on the show, Esc or R.
 */
export function Remote({ onPowerOff, entry, onDigit }: { onPowerOff: () => void; entry: string; onDigit: (d: number) => void }) {
  const [open, setOpenState] = useState(true)
  const openRef = useRef(open)
  const touched = useRef(false)
  const step = useTv((s) => s.step)
  const volume = useTv((s) => s.volume)
  const setVolume = useTv((s) => s.setVolume)
  const toggleMute = useTv((s) => s.toggleMute)
  const muted = useTv((s) => s.muted)
  const slot = useTv((s) => s.dial[s.index])
  const ref = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const scale = useFitScale(body)
  const drag = useRef<{ id: number; y: number; x: number; swiped: boolean } | null>(null)

  const setOpen = useCallback((next: boolean | ((o: boolean) => boolean)) => {
    const v = typeof next === 'function' ? next(openRef.current) : next
    if (v === openRef.current) return
    openRef.current = v
    setOpenState(v)
    track('remote_toggle', { open: v })
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => !touched.current && setOpen(false), 4500)
    return () => window.clearTimeout(t)
  }, [setOpen])

  useEffect(() => {
    const dialogOpen = () => {
      const s = useTv.getState()
      return s.overviewOpen || s.infoOpen || s.submitOpen || s.guideOpen
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'r' || e.key === 'R') setOpen((o) => !o)
      else if (e.key === 'Escape' && !dialogOpen()) setOpen(false)
    }
    // A tap on the show itself lands in its iframe, which the page only notices as losing focus.
    const onBlur = () =>
      window.setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) setOpen(false)
      }, 0)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || ref.current?.contains(t) || t.closest('[role="dialog"]')) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [setOpen])

  const onPointerDown = (e: ReactPointerEvent) => {
    touched.current = true
    drag.current = { id: e.pointerId, y: e.clientY, x: e.clientX, swiped: false }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || d.swiped) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) < SWIPE || Math.abs(dy) < Math.abs(e.clientX - d.x) * 1.4) return
    if (dy > 0 && openRef.current) setOpen(false)
    else if (dy < 0 && !openRef.current) setOpen(true)
    else return
    d.swiped = true
  }
  const endDrag = () => {
    window.setTimeout(() => (drag.current = null), 0)
  }

  const toLastSlot = () => {
    const s = useTv.getState()
    s.tune(s.dial.length - 1)
    if (s.dial[s.dial.length - 1]?.kind === 'empty') window.setTimeout(() => useTv.getState().setSubmitOpen(true), 500)
  }

  const openOverview = () => {
    const s = useTv.getState()
    s.setInfoOpen(false)
    s.setOverviewOpen(true)
  }

  const share = async () => {
    if (!slot) return
    const url = channelUrl(slot.number)
    track('share', { method: 'share' in navigator ? 'native' : 'copy', content_type: 'channel', item_id: String(slot.number), place: 'remote' })
    if (navigator.share) await navigator.share({ title: `第 ${slot.number} 台｜台北安可大舞台`, url }).catch(() => {})
    else await navigator.clipboard?.writeText(url).catch(() => {})
  }

  return (
    <div
      ref={ref}
      className={`remote-wrap fixed right-3 bottom-0 z-40 sm:right-8 ${open ? 'remote-open' : 'remote-peek'}`}
      style={{ '--remote-scale': scale, '--remote-peek': `${Math.max(PEEK, MIN_PEEK / scale)}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        if (drag.current?.swiped) e.stopPropagation()
        else if (!open) {
          e.stopPropagation()
          setOpen(true)
        }
      }}
    >
      <div ref={body} className="remote-body relative w-[168px] px-4 pt-2.5 pb-5 sm:w-[184px]">
        <button
          type="button"
          className="remote-handle group mx-auto mb-2 flex w-full flex-col items-center gap-1 pt-0.5"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? '收起遙控器（往下滑、點電視畫面或按 Esc 也可以）' : '拿起遙控器'}
          aria-expanded={open}
          title={open ? '收起遙控器（R／Esc）' : '拿起遙控器（R）'}
        >
          <span className="remote-grip" aria-hidden />
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-black tracking-[0.12em] text-white/80 group-hover:bg-white/20 group-hover:text-white">
            {open ? (
              <>
                <ChevronDown className="size-3.5" /> 收起
              </>
            ) : (
              <>
                <ChevronUp className="size-3.5" /> 遙控器
              </>
            )}
          </span>
        </button>
        <div className="flex items-center justify-between">
          <span className="remote-led" aria-hidden />
          <span className="text-[10px] font-black tracking-[0.3em] text-white/30">ENCORE</span>
          <Key label="關機" onPress={onPowerOff} className="remote-power size-9 rounded-full">
            <Power className="size-4" />
          </Key>
        </div>

        <button
          type="button"
          className="remote-lcd mt-3 flex h-9 w-full items-center justify-between px-2.5"
          onClick={openOverview}
          aria-label="頻道總覽"
          title="頻道總覽（G）"
        >
          <span className="text-[10px] font-black tracking-[0.18em] text-[#7dff7a]/70">CH</span>
          <span className="font-mono text-lg font-bold tracking-wider text-[#b6ffb0]">{entry ? entry.padEnd(4, '_') : slot?.number}</span>
        </button>
        <Key label="頻道總覽（G）" onPress={openOverview} className="remote-guide mt-2 h-8 w-full gap-1.5 rounded-full text-xs font-black">
          <LayoutGrid className="size-4" /> 頻道總覽
        </Key>

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
          {COLOR_KEYS.map(({ color, hex, emoji, label, action }) => (
            <Key
              key={color}
              label={label}
              onPress={() => {
                track('remote_color_key', { color, action })
                if (action === 'five') playFive(muted ? 0 : volume / 100)
                else location.assign(`${location.pathname}?${action}`)
              }}
              className="h-9 flex-col gap-1 rounded-md pt-1"
            >
              <span className="text-[15px] leading-none" aria-hidden>
                {emoji}
              </span>
              <span className="block h-1 w-full rounded-[2px]" style={{ background: hex }} />
            </Key>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1.5 text-center text-[9px] font-bold text-white/45" aria-hidden>
          {COLOR_KEYS.map(({ color, caption }) => (
            <span key={color}>{caption}</span>
          ))}
        </div>

        <p className="mt-3 hidden text-center text-[10px] leading-snug text-white/35 sm:block">鍵盤 ← → 轉台 · + − 音量 · M 靜音 · I 資訊 · G 總覽 · R 收起</p>
      </div>
    </div>
  )
}
