import { useEffect, useRef, useState } from 'react'
import { stageUrl } from '../routing'
import { sfx } from '../sfx'
import { useTv, type Slot } from '../store'
import { NoSignal } from './NoSignal'
import { StaticNoise } from './StaticNoise'

const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-pointer-lock allow-presentation allow-downloads allow-modals'
const ALLOW = 'autoplay; fullscreen; clipboard-write; encrypted-media; gyroscope; accelerometer; xr-spatial-tracking; web-share'

const slotKey = (s: Slot | undefined) => (s ? `${s.kind}:${s.number}:${s.kind === 'empty' ? '' : s.channel.url}` : '')

/** What the TV is showing: a creator's stage in an iframe, or the empty "signal wanted" slot. */
export function ChannelScreen() {
  const slot = useTv((s) => s.dial[s.index])
  const volume = useTv((s) => s.volume)
  const muted = useTv((s) => s.muted)
  const setPending = useTv((s) => s.setPending)
  const [shown, setShown] = useState<Slot | undefined>(slot)
  const [snow, setSnow] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  const key = slotKey(slot)
  const first = useRef(true)

  useEffect(() => {
    setSnow(true)
    if (!first.current) sfx.static(0.42, 0.3)
    first.current = false
    const t = window.setTimeout(() => setShown(useTv.getState().dial[useTv.getState().index]), 360)
    return () => window.clearTimeout(t)
  }, [key])

  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setSnow(false), shown.kind === 'empty' ? 120 : 2600)
    return () => window.clearTimeout(t)
  }, [shown])

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'encore:volume', volume: volume / 100, muted }, '*')
  }, [volume, muted, shown])

  const onLoad = () => {
    frame.current?.contentWindow?.postMessage({ type: 'encore:volume', volume: volume / 100, muted }, '*')
    window.setTimeout(() => setSnow(false), 180)
  }

  return (
    <div className="fixed inset-0 bg-black">
      {shown && shown.kind !== 'empty' && (
        <iframe
          key={slotKey(shown)}
          ref={frame}
          src={stageUrl(shown.channel.url)}
          title={`第 ${shown.number} 台：${shown.channel.title}`}
          className="absolute inset-0 h-full w-full border-0"
          allow={ALLOW}
          allowFullScreen
          sandbox={SANDBOX}
          onLoad={onLoad}
        />
      )}
      {shown?.kind === 'empty' && <NoSignal number={shown.number} />}

      {shown?.kind === 'pending' && (
        <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 z-20 w-[min(92vw,640px)] -translate-x-1/2">
          <div className="ink-card flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <p className="flex-1 leading-snug">
              <b className="text-[#c8234a]">審核中・只有你看得到這一台。</b>
              管理員通過後才會正式上架，台號可能會變動。
            </p>
            <button type="button" className="ink-btn shrink-0 px-3 py-1 text-xs" onClick={() => setPending(null)}>
              撤回預覽
            </button>
          </div>
        </div>
      )}

      <div className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${snow ? 'opacity-100' : 'opacity-0'}`}>
        <StaticNoise />
      </div>
    </div>
  )
}
