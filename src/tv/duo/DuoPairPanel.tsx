import { Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rpc, RpcError } from '../channel-data'
import type { LinkStatus } from './link'
import { remoteLink } from './mode'

function QrCode({ text }: { text: string }) {
  const [cells, setCells] = useState<boolean[][] | null>(null)
  useEffect(() => {
    let alive = true
    import('uqr')
      .then(({ encode }) => alive && setCells(encode(text, { ecc: 'M', border: 1 }).data))
      .catch(() => alive && setCells(null))
    return () => {
      alive = false
    }
  }, [text])
  if (!cells) return <div className="aspect-square w-full animate-pulse rounded bg-[#0c0812]/10" />
  const size = cells.length
  let d = ''
  cells.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className="block aspect-square w-full" role="img" aria-label="遙控器配對 QR code">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#0c0812" />
    </svg>
  )
}

type CodeState = { code: string } | { error: 'rate' | 'net' } | null

/** A short typed code for the same room, refreshed before it expires and after each pairing (codes are single-use). */
function usePairCode(room: string, active: boolean, joins: number) {
  const [state, setState] = useState<CodeState>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    let timer = 0
    const load = async () => {
      try {
        const r = await rpc<{ code?: unknown; expires_at?: unknown }>('encore_duo_code', { p_room: room })
        if (!alive) return
        if (typeof r?.code === 'string' && /^[0-9]{6}$/.test(r.code)) {
          setState({ code: r.code })
          const left = typeof r.expires_at === 'string' ? Date.parse(r.expires_at) - Date.now() : 0
          timer = window.setTimeout(load, Math.min(Math.max(left - 30000, 20000), 300000))
        } else throw new Error('bad_response')
      } catch (e) {
        if (!alive) return
        setState({ error: e instanceof RpcError && /rate_limited|busy/.test(e.message) ? 'rate' : 'net' })
        timer = window.setTimeout(load, 30000)
      }
    }
    load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [room, active, joins])
  return state
}

/** ?tv: the pairing card, then a small status pill once a remote is connected. */
export function DuoPairPanel({ room, status, remotes, joins }: { room: string; status: LinkStatus; remotes: number; joins: number }) {
  const [open, setOpen] = useState(true)
  const [quietAt, setQuietAt] = useState(-1)
  const code = usePairCode(room, open, joins)
  const link = remoteLink(room)

  useEffect(() => {
    if (joins === 0) return
    const t = window.setTimeout(() => setOpen(false), 600)
    return () => window.clearTimeout(t)
  }, [joins])
  useEffect(() => {
    if (remotes === 0) return
    const t = window.setTimeout(() => setQuietAt(remotes), 4000)
    return () => window.clearTimeout(t)
  }, [remotes])
  const quiet = quietAt === remotes

  const pill =
    status !== 'online'
      ? { text: status === 'offline' ? '網路斷線，重新連線中…' : '連線中…', cls: 'border-[#ffd400]/60 text-[#ffe9a8]' }
      : remotes > 0
        ? { text: remotes > 1 ? `${remotes} 支遙控器已連線` : '遙控器已連線', cls: 'border-[#7dff7a]/50 text-[#b6ffb0]' }
        : { text: '配對遙控器', cls: 'border-white/30 text-white/85' }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`tv-caption fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex items-center gap-1.5 rounded-full border bg-black/55 px-3 py-1.5 text-xs font-black backdrop-blur transition-opacity duration-700 hover:opacity-100 ${pill.cls} ${quiet && remotes > 0 && status === 'online' ? 'opacity-35' : 'opacity-100'}`}
        >
          <Smartphone className="size-3.5" /> {pill.text}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-3" onClick={() => setOpen(false)}>
          <div
            className="ink-card relative flex max-h-[94dvh] w-[min(560px,94vw)] flex-col items-center gap-4 overflow-y-auto p-4 sm:flex-row sm:p-5 landscape:flex-row"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="配對遙控器"
          >
            <button type="button" className="absolute top-2 right-2 rounded-full p-1.5 hover:bg-black/10" onClick={() => setOpen(false)} aria-label="先不用">
              <X className="size-4" />
            </button>
            <div className="w-[min(200px,42vh,60vw)] shrink-0 rounded-lg border-2 border-[#0c0812] bg-white p-2">
              <QrCode text={link} />
            </div>
            <div className="min-w-0 text-center sm:text-left landscape:text-left">
              <p className="text-[11px] font-black tracking-[0.25em] text-[#c8234a]">台北安可電視台 · 窮人版 DUO</p>
              <p className="mt-1.5 text-xl leading-snug font-black">用另一支手機的相機，掃這個 QR code 當遙控器</p>
              <p className="mt-3 text-xs font-bold text-[#4a4f6e]">或在遙控器輸入配對碼</p>
              {code && 'code' in code ? (
                <p className="font-mono text-4xl font-bold tracking-[0.12em] tabular-nums">
                  {code.code.slice(0, 3)} {code.code.slice(3)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#4a4f6e]">
                  {code && 'error' in code ? (code.error === 'rate' ? '配對碼暫時發不出來，請先用掃描的。' : '配對碼拿不到，請用掃描的。') : '配對碼產生中…'}
                </p>
              )}
              <p className="mt-1 text-xs text-[#4a4f6e]">配對碼 5 分鐘內有效，用過就換一組。</p>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold sm:justify-start landscape:justify-start">
                <i className={`block size-2 rounded-full ${status === 'online' ? 'bg-[#2fbf55]' : 'animate-pulse bg-[#f2c21b]'}`} />
                {status === 'online' ? (remotes > 0 ? `已連上 ${remotes} 支遙控器` : '等待遙控器連線') : '連線中…'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
