import { Info, Plus, Power, Share2, Upload, VolumeX } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { sfx } from '../sfx'
import type { Color, DialEntry, StageCommand, StageState, TvPhase } from './protocol'

const BASE = import.meta.env.BASE_URL

export interface PadNote {
  text: string
  tone: 'ok' | 'wait' | 'bad'
}

export interface PadState {
  phase: TvPhase
  n: number | null
  title: string
  entry: string
  muted: boolean
  dial: DialEntry[]
  stage: StageState | null
  note?: PadNote
}

export interface PadActions {
  step: (d: 1 | -1) => void
  tune: (n: number) => void
  digit: (d: number) => void
  vol: (d: 5 | -5) => void
  mute: () => void
  info: () => void
  upload: () => void
  color: (c: Color) => void
  stage: (c: StageCommand) => void
  power: () => void
  share: () => void
}

function Key({
  children,
  onPress,
  label,
  className = '',
  style,
  disabled,
  active,
}: {
  children: ReactNode
  onPress: () => void
  label: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      data-on={active || undefined}
      style={style}
      className={`remote-key duo-key flex min-h-0 min-w-0 touch-manipulation items-center justify-center select-none disabled:opacity-40 ${className}`}
      onClick={() => {
        void sfx.unlock()
        sfx.click()
        onPress()
      }}
    >
      {children}
    </button>
  )
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

/** The channel's share image, falling back to its text card, then to its title on a dark tile. */
function Thumb({ entry, on, onPick, className }: { entry: DialEntry; on: boolean; onPick: () => void; className: string }) {
  const [src, setSrc] = useState<string | null>(`${BASE}og/${entry.n}.${entry.k === 'live' ? 'jpg' : 'png'}`)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!on) return
    const el = ref.current
    const row = el?.parentElement
    if (el && row) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
  }, [on])
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        void sfx.unlock()
        sfx.click()
        onPick()
      }}
      aria-label={`轉到第 ${entry.n} 台：${entry.t || '訊號徵求中'}`}
      className={`duo-thumb relative shrink-0 snap-center overflow-hidden rounded-lg bg-[#0b0a0e] text-left ${on ? 'duo-thumb--on' : ''} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setSrc((s) => (s?.endsWith('.jpg') ? `${BASE}og/${entry.n}.png` : null))}
        />
      ) : (
        <span className="line-clamp-2 p-1.5 text-[10px] leading-tight text-white/70">{entry.k === 'empty' ? '訊號徵求中' : entry.t}</span>
      )}
      <b className="absolute bottom-0.5 left-1 rounded-[3px] bg-black/75 px-1 font-mono text-[10px] text-[#b6ffb0]">{entry.n}</b>
    </button>
  )
}

function Strip({ state, actions, size }: { state: PadState; actions: PadActions; size: string }) {
  if (!state.dial.length) return <div className={`${size} shrink-0 rounded-lg border border-dashed border-white/10`} />
  return (
    <div className="duo-strip flex shrink-0 snap-x gap-2 overflow-x-auto overscroll-x-contain">
      {state.dial.map((e) => (
        <Thumb key={`${e.n}:${e.k}`} entry={e} on={e.n === state.n} onPick={() => actions.tune(e.n)} className={size} />
      ))}
    </div>
  )
}

function Lcd({ state }: { state: PadState }) {
  const shown = state.entry ? state.entry.padEnd(4, '_') : state.n ?? '----'
  const tone = state.note?.tone
  return (
    <div className="remote-lcd flex h-full min-w-0 items-center gap-2 px-2.5">
      <span className="text-[10px] font-black tracking-[0.18em] text-[#7dff7a]/70">CH</span>
      <span className="font-mono text-lg font-bold tracking-wider text-[#b6ffb0]">{shown}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-[#b6ffb0]/75">{state.title}</span>
      {state.note && (
        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-bold ${tone === 'ok' ? 'text-[#7dff7a]' : tone === 'bad' ? 'text-[#ff8a99]' : 'text-[#ffd400]'}`}>
          <i className={`block size-1.5 rounded-full ${tone === 'ok' ? 'bg-[#7dff7a]' : tone === 'bad' ? 'bg-[#ff5a6e]' : 'animate-pulse bg-[#ffd400]'}`} />
          {state.note.text}
        </span>
      )}
    </div>
  )
}

function PowerKey({ state, actions }: { state: PadState; actions: PadActions }) {
  const label = state.phase === 'gate' ? '打開電視' : state.phase === 'intro' ? '略過開場' : '關機'
  return (
    <Key label={label} onPress={actions.power} disabled={state.phase === 'off'} className={`remote-power size-10 shrink-0 rounded-full ${state.phase === 'gate' ? 'animate-pulse' : ''}`}>
      <Power className="size-4" />
    </Key>
  )
}

/** When the TV is not showing channels yet (or any more), say so and offer the one thing that helps. */
function Banner({ state, actions }: { state: PadState; actions: PadActions }) {
  if (state.phase === 'tv') return null
  const text = state.phase === 'gate' ? '電視還沒打開' : state.phase === 'intro' ? '開場播放中' : '片尾播放中，結束後回到開機畫面'
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#ffd400]/10 px-3 py-2 text-sm font-bold text-[#ffe9a8]">
      <span className="min-w-0 flex-1">{text}</span>
      {state.phase !== 'off' && (
        <button type="button" className="ink-btn shrink-0 px-3 py-1 text-sm" data-on="true" onClick={actions.power}>
          {state.phase === 'gate' ? '▶ 打開電視' : '略過開場 ▶▶'}
        </button>
      )}
    </div>
  )
}

function NumPad({ actions, wide }: { actions: PadActions; wide: boolean }) {
  const digits = wide ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] : [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const cls = 'rounded-full text-[clamp(14px,2.2vh,20px)] font-bold'
  return (
    <>
      {digits.map((d) => (
        <Key key={d} label={`數字 ${d}`} onPress={() => actions.digit(d)} className={cls}>
          {d}
        </Key>
      ))}
      <Key label="頻道資訊" onPress={actions.info} className={cls}>
        <Info className="size-4" />
      </Key>
      {!wide && (
        <Key label="數字 0" onPress={() => actions.digit(0)} className={cls}>
          0
        </Key>
      )}
      <Key label="上架你的舞台" onPress={actions.upload} className={`${cls} text-[#ffd400]`}>
        <Upload className="size-4" />
      </Key>
    </>
  )
}

function Rocker({ kind, actions }: { kind: 'ch' | 'vol'; actions: PadActions }) {
  return (
    <div className="remote-rocker flex h-full min-h-0 flex-col items-stretch">
      {kind === 'ch' ? (
        <>
          <Key label="下一台" onPress={() => actions.step(1)} className="flex-1 rounded-t-[999px] rounded-b-xl text-[clamp(18px,3vh,28px)]">
            ▲
          </Key>
          <span className="py-1.5 text-center text-[10px] font-black tracking-[0.2em] text-white/55">CH</span>
          <Key label="上一台" onPress={() => actions.step(-1)} className="flex-1 rounded-t-xl rounded-b-[999px] text-[clamp(18px,3vh,28px)]">
            ▼
          </Key>
        </>
      ) : (
        <>
          <Key label="大聲一點" onPress={() => actions.vol(5)} className="flex-1 rounded-t-[999px] rounded-b-xl">
            <Plus className="size-6" />
          </Key>
          <span className="py-1.5 text-center text-[10px] font-black tracking-[0.2em] text-white/55">VOL</span>
          <Key label="小聲一點" onPress={() => actions.vol(-5)} className="flex-1 rounded-t-xl rounded-b-[999px] text-[clamp(22px,3.4vh,32px)] leading-none">
            −
          </Key>
        </>
      )}
    </div>
  )
}

const VIEWS: [StageState['view'], string][] = [
  ['front', '正面'],
  ['close', '特寫'],
  ['iso', '等角'],
  ['orbit', '環繞'],
]

function StageRow({ stage, actions, wrap }: { stage: StageState; actions: PadActions; wrap: boolean }) {
  const chip = wrap ? 'h-8 shrink-0 rounded-full px-3 text-xs font-bold' : 'h-8 min-w-0 flex-1 rounded-full px-1 text-xs font-bold whitespace-nowrap'
  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${wrap ? 'flex-wrap' : ''}`} aria-label="舞台控制">
      {wrap && <span className="shrink-0 rounded-full bg-[#ffd400] px-2 py-0.5 text-[11px] font-black text-[#0c0812]">舞台</span>}
      {VIEWS.map(([v, label]) => (
        <Key key={v} label={`鏡頭：${label}`} active={stage.view === v} onPress={() => actions.stage({ a: 'view', v })} className={chip}>
          {label}
        </Key>
      ))}
      <span className="h-4 w-px shrink-0 bg-white/15" />
      <Key label="官方 MV" active={stage.music === 'youtube'} disabled={stage.ytFailed} onPress={() => actions.stage({ a: 'music', v: 'youtube' })} className={chip}>
        MV
      </Key>
      <Key label="內建節拍" active={stage.music === 'synth'} onPress={() => actions.stage({ a: 'music', v: 'synth' })} className={chip}>
        節拍
      </Key>
      <span className="h-4 w-px shrink-0 bg-white/15" />
      <Key label={stage.troupe === 'solo' ? '叫伴舞上台' : '換一批伴舞'} active={stage.troupe !== 'solo'} onPress={() => actions.stage({ a: 'troupe', v: 'next' })} className={chip}>
        {stage.troupe === 'solo' ? '叫伴舞' : '換一批'}
      </Key>
      <Key label="市長獨舞" active={stage.troupe === 'solo'} onPress={() => actions.stage({ a: 'troupe', v: 'solo' })} className={chip}>
        獨舞
      </Key>
    </div>
  )
}

const COLORS: [Color, string, string][] = [
  ['red', '#e2363f', '紅色鍵'],
  ['green', '#2fbf55', '綠色鍵'],
  ['yellow', '#f2c21b', '黃色鍵'],
  ['blue', '#2f7bff', '藍色鍵'],
]

function ColorKeys({ actions }: { actions: PadActions }) {
  return (
    <>
      {COLORS.map(([c, hex, label]) => (
        <Key key={c} label={label} onPress={() => actions.color(c)} className="min-w-0 flex-1 rounded-md px-2">
          <span className="block h-2 w-full rounded-[2px]" style={{ background: hex }} />
        </Key>
      ))}
    </>
  )
}

/**
 * The full-size remote for the Duo layouts. It lays itself out for the box it is given:
 * tall (a phone held upright) reads like a real remote; wide (the lower half of an iPhone Duo,
 * or a phone held sideways) puts channel and volume under each thumb.
 */
export function RemotePad({ state, actions, header, insetTop = true }: { state: PadState; actions: PadActions; header?: ReactNode; insetTop?: boolean }) {
  const [ref, { w, h }] = useBox()
  const tall = h > w * 1.12
  const short = tall && h < 620
  const sixAcross = !tall && h > 0 && h < 430
  const pad: CSSProperties = {
    paddingTop: insetTop ? 'max(12px, env(safe-area-inset-top))' : '12px',
    paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(14px, env(safe-area-inset-left))',
    paddingRight: 'max(14px, env(safe-area-inset-right))',
  }
  const mute = (
    <Key label={state.muted ? '取消靜音' : '靜音'} onPress={actions.mute} className={`h-full w-full rounded-full ${state.muted ? 'text-[#ff5a6e]' : ''}`}>
      <VolumeX className="size-4" />
    </Key>
  )
  const share = (
    <Key label="分享這一台" onPress={actions.share} disabled={state.n == null} className="h-full w-full rounded-full">
      <Share2 className="size-4" />
    </Key>
  )
  const top = (
    <div className="flex h-10 shrink-0 items-center gap-2">
      <span className="remote-led duo-led shrink-0" aria-hidden />
      <div className="h-full min-w-0 flex-1">
        <Lcd state={state} />
      </div>
      {header}
      <PowerKey state={state} actions={actions} />
    </div>
  )

  return (
    <div ref={ref} className="duo-pad relative h-full w-full overflow-hidden text-[#eeeef2]">
      {w > 0 && tall && (
        <div className={`flex h-full w-full flex-col overflow-y-auto overscroll-contain ${short ? 'gap-1.5' : 'gap-[clamp(8px,1.5vh,14px)]'}`} style={pad}>
          {top}
          <Banner state={state} actions={actions} />
          <Strip state={state} actions={actions} size={short ? 'h-[46px] w-[82px]' : 'h-[52px] w-[92px]'} />
          <div className={`grid flex-[1.25] grid-cols-3 grid-rows-4 ${short ? 'min-h-[148px] gap-1.5' : 'min-h-[168px] gap-2'}`}>
            <NumPad actions={actions} wide={false} />
          </div>
          <div className={`grid flex-1 grid-cols-[1fr_minmax(64px,0.6fr)_1fr] gap-3 ${short ? 'min-h-[100px]' : 'min-h-[128px]'}`}>
            <Rocker kind="ch" actions={actions} />
            <div className="grid grid-rows-2 gap-2">
              {mute}
              {share}
            </div>
            <Rocker kind="vol" actions={actions} />
          </div>
          {state.stage && <StageRow stage={state.stage} actions={actions} wrap={!short} />}
          <div className={`flex shrink-0 gap-2 ${short ? 'h-7' : 'h-8'}`}>
            <ColorKeys actions={actions} />
          </div>
        </div>
      )}
      {w > 0 && !tall && (
        <div className="grid h-full w-full grid-cols-[minmax(76px,15%)_minmax(0,1fr)_minmax(76px,15%)] gap-[clamp(8px,2vw,16px)]" style={pad}>
          <Rocker kind="ch" actions={actions} />
          <div className="flex min-h-0 min-w-0 flex-col gap-[clamp(6px,1.4vh,10px)] overflow-y-auto overscroll-contain">
            {top}
            <Banner state={state} actions={actions} />
            <Strip state={state} actions={actions} size="h-[54px] w-[96px]" />
            <div className={`grid min-h-[84px] flex-1 gap-2 ${sixAcross ? 'grid-cols-6 grid-rows-2' : 'grid-cols-3 grid-rows-4'}`}>
              <NumPad actions={actions} wide={sixAcross} />
            </div>
            {state.stage && <StageRow stage={state.stage} actions={actions} wrap={false} />}
            <div className="flex h-9 shrink-0 gap-2">
              <div className="w-14 shrink-0">{mute}</div>
              <ColorKeys actions={actions} />
              <div className="w-14 shrink-0">{share}</div>
            </div>
          </div>
          <Rocker kind="vol" actions={actions} />
        </div>
      )}
    </div>
  )
}
