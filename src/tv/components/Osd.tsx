import { useEffect, useState } from 'react'
import { useTv } from '../store'

/** LCD-TV style on-screen display: channel number top-right, programme banner, volume bar. */
export function Osd() {
  const nonce = useTv((s) => s.osdNonce)
  const kind = useTv((s) => s.osdKind)
  const slot = useTv((s) => s.dial[s.index])
  const volume = useTv((s) => s.volume)
  const muted = useTv((s) => s.muted)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), kind === 'volume' ? 1800 : 3600)
    return () => window.clearTimeout(t)
  }, [nonce, kind])

  if (!slot) return null
  const title = slot.kind === 'empty' ? '訊號徵求中' : slot.channel.title
  const author = slot.kind === 'empty' ? '這一台還空著' : slot.channel.author

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none" aria-live="polite">
      <div
        className={`osd-fade absolute top-[max(1rem,env(safe-area-inset-top))] right-4 text-right sm:top-6 sm:right-8 ${visible && kind === 'channel' ? 'opacity-100' : 'opacity-0'}`}
      >
        <p className="osd-digits text-[56px] leading-none sm:text-[88px]">{slot.number}</p>
        <p className="osd-label mt-1 inline-block max-w-[70vw] truncate px-2 py-0.5 text-sm font-black sm:text-lg">
          {slot.kind === 'pending' ? '審核中 · ' : ''}
          {title}
        </p>
      </div>

      <div
        className={`osd-fade absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 sm:right-auto sm:bottom-8 sm:left-8 sm:w-[520px] ${visible && kind === 'channel' ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <div className="osd-banner flex items-stretch overflow-hidden rounded-md">
          <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-[#ffd400] px-2 text-[#0c0812] sm:w-24">
            <span className="text-[10px] font-black tracking-[0.2em]">CH</span>
            <span className="text-2xl font-black tabular-nums sm:text-3xl">{slot.number}</span>
          </div>
          <div className="min-w-0 flex-1 px-3 py-2 sm:px-4">
            <p className="truncate text-base font-black text-white sm:text-lg">{title}</p>
            <p className="truncate text-xs text-[#c9d3ff] sm:text-sm">
              {slot.kind === 'empty' ? author : `by ${author}`}
              <span className="text-white/50"> · 按 i 看資訊 · ← → 轉台</span>
            </p>
          </div>
        </div>
      </div>

      <div
        className={`osd-fade absolute bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 ${visible && kind === 'volume' ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="osd-banner flex items-center gap-3 rounded-md px-4 py-2.5">
          <span className="w-16 text-sm font-black text-white">{muted ? '靜音' : '音量'}</span>
          <div className="flex gap-[3px]">
            {Array.from({ length: 25 }, (_, i) => (
              <span
                key={i}
                className={`h-4 w-[6px] rounded-[1px] ${!muted && i < Math.round(volume / 4) ? 'bg-[#7dff7a]' : 'bg-white/15'}`}
              />
            ))}
          </div>
          <span className="osd-digits w-10 text-right text-2xl leading-none">{muted ? '—' : volume}</span>
        </div>
      </div>
    </div>
  )
}
