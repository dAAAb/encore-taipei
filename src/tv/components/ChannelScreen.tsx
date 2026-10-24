import { useEffect, useRef, useState } from 'react'
import { DUO_MODE } from '../duo/mode'
import { parseStageCommand, parseStageState } from '../duo/protocol'
import { stageUrl } from '../routing'
import { sfx } from '../sfx'
import { useTv, type Slot } from '../store'
import { NoSignal } from './NoSignal'
import { StaticNoise } from './StaticNoise'

const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-pointer-lock allow-presentation allow-downloads allow-modals'
const ALLOW = 'autoplay; fullscreen; clipboard-write; encrypted-media; gyroscope; accelerometer; xr-spatial-tracking; web-share'

const slotKey = (s: Slot | undefined) => (s ? `${s.kind}:${s.number}:${s.kind === 'empty' ? '' : s.channel.url}` : '')

/** In the Duo layouts the remote carries the stage's own buttons, so built-in stages hide theirs. */
const REMOTE_HAS_STAGE_CONTROLS = DUO_MODE === 'split' || DUO_MODE === 'tv'

/** What the TV is showing: a creator's stage in an iframe, or the empty "signal wanted" slot. Fills its parent. */
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

  useEffect(() => {
    const forward = (e: Event) => frame.current?.contentWindow?.postMessage({ type: 'encore:color', color: (e as CustomEvent<string>).detail }, '*')
    const forwardStage = (e: Event) => {
      const cmd = parseStageCommand((e as CustomEvent<unknown>).detail)
      if (cmd) frame.current?.contentWindow?.postMessage({ type: 'encore:stage', ...cmd }, '*')
    }
    // Only the stage on screen may report its state; anything else posting messages is ignored.
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      const d = e.data as { type?: string } | null
      if (d?.type !== 'encore:stage-state') return
      const stage = parseStageState(d)
      if (!stage) return
      useTv.setState({ stage })
      // The stage may have missed the message sent at iframe load (its listener attaches later), so answer here too.
      frame.current.contentWindow?.postMessage({ type: 'encore:chrome', remote: REMOTE_HAS_STAGE_CONTROLS }, '*')
    }
    window.addEventListener('encore:color', forward)
    window.addEventListener('encore:stage', forwardStage)
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('encore:color', forward)
      window.removeEventListener('encore:stage', forwardStage)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  useEffect(() => {
    useTv.setState({ stage: null })
  }, [shown])

  const onLoad = () => {
    const win = frame.current?.contentWindow
    win?.postMessage({ type: 'encore:volume', volume: volume / 100, muted }, '*')
    win?.postMessage({ type: 'encore:chrome', remote: REMOTE_HAS_STAGE_CONTROLS }, '*')
    win?.postMessage({ type: 'encore:hello' }, '*')
    window.setTimeout(() => setSnow(false), 180)
  }

  return (
    <div className="absolute inset-0 bg-black">
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
