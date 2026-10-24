import { Delete, RefreshCw, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { fetchLiveChannels, rpc, RpcError, type Channel } from '../channel-data'
import { SUBMIT_PATH } from '../routing'
import { sfx } from '../sfx'
import { openLink, peerId, rateLimiter, useWakeLock, type DuoLink, type LinkStatus } from './link'
import { isRoom, saveRemoteRoom, takeRemoteRoom } from './mode'
import { isPeerId, parseSnapshot, type Command, type DialEntry, type TvSnapshot } from './protocol'
import { RemotePad, type PadActions, type PadNote, type PadState } from './RemotePad'
import { shareChannel } from './tvControl'

const BASE = import.meta.env.BASE_URL
const TV_LINK = `${location.host}${BASE}?duo=tv`

function useLandscape() {
  const [land, setLand] = useState(() => window.innerWidth > window.innerHeight)
  useEffect(() => {
    const on = () => setLand(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return land
}

/** No room yet: type the 6-digit code the TV shows (scanning its QR code skips this screen). */
function PairScreen({ onPaired }: { onPaired: (room: string) => void }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const land = useLandscape()

  const claim = async (c: string) => {
    setBusy(true)
    setMsg(null)
    try {
      const room = await rpc<unknown>('encore_duo_claim', { p_code: c })
      if (isRoom(room)) {
        track('duo_paired', { via: 'code' })
        onPaired(room)
        return
      }
      setMsg('配對碼不對或已過期，請看電視上最新的配對碼。')
    } catch (e) {
      setMsg(e instanceof RpcError && e.message === 'rate_limited' ? '現在嘗試的人太多，請等一分鐘再試，或改用掃描的。' : '網路連不上，請稍後再試。')
    } finally {
      setBusy(false)
    }
    setCode('')
  }

  const press = (d: number | 'del') => {
    if (busy) return
    void sfx.unlock()
    sfx.click()
    setMsg(null)
    setCode((c) => {
      if (d === 'del') return c.slice(0, -1)
      if (c.length >= 6) return c
      const next = c + d
      if (next.length === 6) void claim(next)
      return next
    })
  }

  const keys: (number | 'del' | null)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del']
  return (
    <div
      className={`duo-pad grid h-full w-full gap-5 overflow-y-auto text-[#eeeef2] ${land ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center' : 'grid-rows-[auto_1fr] content-start'}`}
      style={{
        paddingTop: 'max(20px, env(safe-area-inset-top))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      }}
    >
      <div>
        <p className="flex items-center gap-2">
          <span className="remote-led duo-led" aria-hidden />
          <span className="text-[11px] font-black tracking-[0.35em] text-white/45">ENCORE</span>
        </p>
        <h1 className="mt-3 text-[28px] leading-tight font-black">這支是遙控器</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          用 iPhone 內建相機掃「電視」那支手機上的 QR code 最快。也可以在這裡輸入它顯示的 6 位數配對碼。
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/5 p-3 text-xs leading-relaxed text-white/60">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          <span>
            還沒有電視？在另一支手機打開 <b className="font-mono text-[#ffd400]">{TV_LINK}</b>，兩支打橫上下貼在一起，就是窮人版 Duo。
          </span>
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-3">
        <div className="remote-lcd flex h-16 items-center justify-center gap-3 px-3">
          <span className="text-[11px] font-black tracking-[0.2em] text-[#7dff7a]/70">配對碼</span>
          <span className="font-mono text-3xl font-bold tracking-[0.2em] text-[#b6ffb0]">
            {code.padEnd(6, '_').slice(0, 3)} {code.padEnd(6, '_').slice(3)}
          </span>
        </div>
        <p className={`min-h-5 text-center text-sm font-bold ${msg ? 'text-[#ff8a99]' : 'text-white/50'}`} role="status">
          {busy ? '配對中…' : msg ?? ''}
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((k, i) =>
            k === null ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={busy}
                aria-label={k === 'del' ? '刪除' : `數字 ${k}`}
                onClick={() => press(k)}
                className="remote-key flex h-14 touch-manipulation items-center justify-center rounded-full text-xl font-bold select-none disabled:opacity-50"
              >
                {k === 'del' ? <Delete className="size-5" /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

const dialFrom = (rows: Channel[]): DialEntry[] => rows.map((c) => ({ n: c.channel, t: c.title, k: 'live' }))

function ConnectedRemote({ room, viaLink, onUnpair }: { room: string; viaLink: boolean; onUnpair: () => void }) {
  const me = useMemo(() => peerId(), [])
  const [snap, setSnap] = useState<TvSnapshot | null>(null)
  const [lastSeen, setLastSeen] = useState(0)
  const [onlineAt, setOnlineAt] = useState(0)
  const [status, setStatus] = useState<LinkStatus>('connecting')
  const [now, setNow] = useState(() => Date.now())
  const [fallback, setFallback] = useState<DialEntry[]>([])
  const link = useRef<DuoLink | null>(null)
  const allow = useMemo(() => rateLimiter(10, 16), [])
  const reported = useRef(false)

  useEffect(() => {
    const l = openLink(
      room,
      (event, payload) => {
        if (event !== 'state') return
        const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
        if (!p || !isPeerId(p.from)) return
        const s = parseSnapshot(p.s)
        if (!s) return
        const at = Date.now()
        setSnap(s)
        setLastSeen(at)
        setNow(at)
      },
      (s) => {
        setStatus(s)
        if (s === 'online') {
          const at = Date.now()
          setOnlineAt(at)
          setNow(at)
          l.send('hello', { from: me })
        }
      },
    )
    link.current = l
    const beat = window.setInterval(() => {
      l.send('hello', { from: me })
      setNow(Date.now())
    }, 4000)
    return () => {
      window.clearInterval(beat)
      l.close()
      link.current = null
    }
  }, [room, me])

  useEffect(() => {
    fetchLiveChannels()
      .catch(() => fetch(`${BASE}channels.json`).then((r) => r.json() as Promise<Channel[]>))
      .then((rows) => Array.isArray(rows) && setFallback(dialFrom(rows)))
      .catch(() => {})
  }, [])

  const fresh = lastSeen > 0 && now - lastSeen < 12000
  useEffect(() => {
    if (fresh && !reported.current) {
      reported.current = true
      if (viaLink) track('duo_paired', { via: 'qr' })
    }
  }, [fresh, viaLink])

  const lost = status === 'online' && !fresh && onlineAt > 0 && now - Math.max(onlineAt, lastSeen) > 8000
  const note: PadNote =
    status === 'offline'
      ? { text: '網路斷線', tone: 'bad' }
      : status === 'connecting'
        ? { text: '連線中', tone: 'wait' }
        : fresh
          ? { text: '已連線', tone: 'ok' }
          : lost
            ? { text: '找不到電視', tone: 'bad' }
            : { text: '找電視中', tone: 'wait' }

  const send = (c: Command) => {
    if (allow()) link.current?.send('cmd', { from: me, c })
  }

  const state: PadState = snap
    ? { phase: snap.phase, n: snap.n, title: snap.title, entry: snap.entry, muted: snap.muted, dial: snap.dial.length ? snap.dial : fallback, stage: snap.stage, note }
    : { phase: 'tv', n: null, title: '', entry: '', muted: false, dial: fallback, stage: null, note }

  const actions: PadActions = {
    step: (d) => send({ k: 'step', d }),
    tune: (n) => send({ k: 'tune', n }),
    digit: (d) => send({ k: 'digit', d }),
    vol: (d) => send({ k: 'vol', d }),
    mute: () => send({ k: 'mute' }),
    info: () => send({ k: 'info' }),
    power: () => send({ k: 'power' }),
    color: (c) => send({ k: 'color', c }),
    stage: (c) => send({ k: 'stage', ...c }),
    upload: () => window.open(`${location.origin}${SUBMIT_PATH}`, '_blank', 'noopener'),
    share: () => void shareChannel(snap?.n ?? null, 'duo_remote'),
  }

  return (
    <div className="relative h-full w-full">
      <RemotePad
        state={state}
        actions={actions}
        header={
          <button type="button" onClick={onUnpair} className="shrink-0 rounded-full p-1.5 text-white/45 hover:text-white" aria-label="重新配對" title="重新配對">
            <RefreshCw className="size-4" />
          </button>
        }
      />
      {lost && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-xl border border-[#ff5a6e]/40 bg-[#1b1a20]/95 p-3 text-sm text-white/85 shadow-2xl backdrop-blur">
          <p className="font-black text-[#ff8a99]">找不到電視</p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            確認當電視的手機還開著 <b className="font-mono text-[#ffd400]">{TV_LINK}</b>，螢幕沒有鎖定。也可以重新掃它的 QR code。
          </p>
          <button type="button" className="ink-btn mt-2 px-3 py-1 text-xs" onClick={onUnpair}>
            重新配對
          </button>
        </div>
      )}
    </div>
  )
}

/** ?duo=remote: this phone is only the remote for a TV opened with ?duo=tv. */
export default function DuoRemoteApp() {
  const [initial] = useState(takeRemoteRoom)
  const [room, setRoom] = useState<string | null>(initial.room)
  useWakeLock(true)

  useEffect(() => {
    document.title = '遙控器｜台北安可電視台'
    document.documentElement.style.background = '#121116'
    document.body.style.background = '#121116'
    track('duo_open', { mode: 'remote' })
  }, [])

  if (!room)
    return (
      <PairScreen
        onPaired={(r) => {
          saveRemoteRoom(r)
          setRoom(r)
        }}
      />
    )
  return (
    <ConnectedRemote
      key={room}
      room={room}
      viaLink={initial.viaLink && room === initial.room}
      onUnpair={() => {
        saveRemoteRoom(null)
        setRoom(null)
      }}
    />
  )
}
