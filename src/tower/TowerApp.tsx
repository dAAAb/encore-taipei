import { Tv, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { initAnalytics, track, trackPage } from '@/lib/analytics'
import { fetchLiveChannels, type Channel } from '@/tv/channel-data'
import { Guide } from '@/tv/components/Guide'
import { SubmitForm } from '@/tv/components/SubmitForm'
import { sfx } from '@/tv/sfx'
import { useTv } from '@/tv/store'
import { recentChat, type ChatMessage } from './chat'
import { floorsFor, floorTitle, type Floor } from './layout'
import { floorFromPath, floorPath, syncTowerUrl } from './routing'
import { rig } from './scene/rigState'
import { TowerScene } from './scene/TowerScene'
import { setHum, startHum } from './sfx'
import { useTower } from './store'
import { DronePad } from './ui/DronePad'
import { FloorView } from './ui/FloorView'
import { HoverTag } from './ui/HoverTag'
import { RoofChat } from './ui/RoofChat'

const BASE = import.meta.env.BASE_URL
const TITLE = '台北安可大樓 ENCORE TOWER｜每一層都是一場台北安可派對'

function detectWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function TowerApp() {
  const mode = useTower((s) => s.mode)
  const target = useTower((s) => s.target)
  const dial = useTv((s) => s.dial)
  const muted = useTv((s) => s.muted)
  const toggleMute = useTv((s) => s.toggleMute)
  const floors = useMemo(() => floorsFor(dial), [dial])
  const next = dial[dial.length - 1]?.number ?? 2026
  const [deepLink] = useState(floorFromPath)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const webgl = useMemo(detectWebGL, [])
  const lowPower = useMemo(() => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4, [])
  const nearRoof = mode === 'tower' && target > floors.length - 0.6

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __tower: useTower, __rig: rig })
    initAnalytics({ pageView: false })
    trackPage(location.pathname, document.title)
    const apply = (rows: Channel[]) => useTv.getState().setChannels(rows)
    fetchLiveChannels()
      .then(apply)
      .catch(() =>
        fetch(`${BASE}channels.json`)
          .then((r) => r.json() as Promise<Channel[]>)
          .then(apply)
          .catch(() => {}),
      )
  }, [])

  useEffect(() => {
    const unsub = useTv.subscribe((s, prev) => {
      if (s.volume !== prev.volume || s.muted !== prev.muted) sfx.setLevel(s.volume, s.muted)
    })
    sfx.setLevel(useTv.getState().volume, useTv.getState().muted)
    return unsub
  }, [])

  // the rooftop chat refreshes while anyone is up there
  useEffect(() => {
    let alive = true
    const load = () =>
      recentChat()
        .then((m) => alive && setMessages(m))
        .catch(() => {})
        .finally(() => alive && setChatLoading(false))
    load()
    if (!nearRoof) return () => void (alive = false)
    const t = window.setInterval(load, 6000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [nearRoof])

  useEffect(() => {
    if (nearRoof) track('roof_visit')
  }, [nearRoof])

  // drone hum follows how hard it's flying
  useEffect(() => {
    let raf = 0
    let last = rig.focus
    const tick = () => {
      const m = useTower.getState().mode
      const speed = Math.min(1, Math.abs(rig.focus - last) * 30 + Math.abs(rig.yawSpeed) * 0.5)
      last = rig.focus
      setHum(speed, m === 'tower' || m === 'entering' || m === 'leaving')
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const enter = useCallback(
    (f: Floor) => {
      const s = useTower.getState()
      if (s.mode !== 'tower') return
      s.setTarget(f.index)
      s.setActive(f.index)
      s.setHover(null)
      s.setMode('entering')
      sfx.whoosh(1.2, true, 0.35)
      track('floor_enter', { floor: f.number, floor_title: floorTitle(f) })
    },
    [],
  )

  const entered = useCallback(() => {
    const s = useTower.getState()
    const f = floors[s.active]
    s.setMode('floor')
    if (f) {
      syncTowerUrl(f.number, `${f.number} 樓｜${floorTitle(f)}｜台北安可大樓`, true)
      trackPage(floorPath(f.number), document.title)
    }
  }, [floors])

  const leave = useCallback(() => {
    const s = useTower.getState()
    if (s.mode !== 'floor') return
    s.setTarget(s.active)
    s.setMode('leaving')
    sfx.whoosh(1.0, false, 0.3)
    syncTowerUrl(null, TITLE)
    track('floor_exit')
  }, [])

  const left = useCallback(() => useTower.getState().setMode('tower'), [])

  /** Elevator ride between occupied floors; going up past the last one takes you out to the roof. */
  const step = useCallback(
    (d: number) => {
      const s = useTower.getState()
      const lastSlot = floors.findLastIndex((f) => f.kind === 'slot')
      const to = s.active + d
      if (to > lastSlot) {
        s.setTarget(floors.length)
        s.setActive(s.active)
        leave()
        window.setTimeout(() => useTower.getState().setTarget(floors.length), 50)
        return
      }
      if (to < 0) return
      s.setActive(to)
      const f = floors[to]
      syncTowerUrl(f.number, `${f.number} 樓｜${floorTitle(f)}｜台北安可大樓`)
      trackPage(floorPath(f.number), document.title)
      track('floor_switch', { floor: f.number })
    },
    [floors, leave],
  )

  // keyboard: arrows fly / ride the elevator, Enter flies in, Esc flies out
  useEffect(() => {
    const handle = (key: string) => {
      const s = useTower.getState()
      const tv = useTv.getState()
      if (tv.submitOpen || tv.guideOpen) return false
      if (s.mode === 'tower') {
        const at = Math.max(0, Math.min(floors.length, Math.round(s.target)))
        if (key === 'ArrowUp' || key === 'ArrowRight' || key === 'w') s.setTarget(Math.min(floors.length, at + 1))
        else if (key === 'ArrowDown' || key === 'ArrowLeft' || key === 's') s.setTarget(Math.max(0, at - 1))
        else if (key === '+' || key === '=') s.setZoom(s.zoom - 0.2)
        else if (key === '-' || key === '_') s.setZoom(s.zoom + 0.2)
        else if (key === 'Enter' && at < floors.length) enter(floors[at])
        else return false
        rig.lastInput = performance.now()
        return true
      }
      if (s.mode === 'floor') {
        if (key === 'ArrowUp' || key === 'ArrowRight') step(1)
        else if (key === 'ArrowDown' || key === 'ArrowLeft') step(-1)
        else if (key === 'Escape' || key === 'Backspace') leave()
        else if (key === 'm' || key === 'M') useTv.getState().toggleMute()
        else return false
        return true
      }
      return false
    }
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (handle(e.key)) e.preventDefault()
    }
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; key?: string } | null
      if (data?.type === 'encore:key' && typeof data.key === 'string') handle(data.key)
    }
    const onPop = () => {
      if (useTower.getState().mode === 'floor' && floorFromPathNow() == null) leave()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('message', onMessage)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('popstate', onPop)
    }
  }, [floors, enter, leave, step])

  const takeOff = async () => {
    await sfx.unlock()
    startHum()
    sfx.powerOn()
    const s = useTower.getState()
    const deep = deepLink != null ? floors.findIndex((f) => f.number === deepLink) : -1
    s.setTarget(deep >= 0 ? deep : 0)
    s.setMode('tower')
    track('tower_takeoff', { deep_link: deepLink ?? undefined })
    if (deep >= 0) window.setTimeout(() => enter(floors[deep]), 3400)
  }

  const inside = mode === 'floor'
  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <h1 className="sr-only">台北安可大樓 ENCORE TOWER：每一層樓都是一位市民用 AI 做的台北安可派對</h1>

      {webgl ? (
        <div className={`absolute inset-0 transition-opacity duration-500 ${inside ? 'opacity-0' : 'opacity-100'}`}>
          <TowerScene floors={floors} messages={messages} nearRoof={nearRoof} lowPower={lowPower} onPick={enter} onEntered={entered} onLeft={left} />
        </div>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">這個瀏覽器不支援 3D，請改用電腦或新版手機瀏覽器開啟。</p>
      )}

      {inside && <FloorView floors={floors} next={next} onLeave={leave} onStep={step} />}

      {mode !== 'gate' && !inside && (
        <>
          <header className="pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-20 select-none">
            <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2 py-px text-[10px] font-black tracking-[0.14em] text-[#0c0812] shadow-[2px_2px_0_#0c0812] sm:text-[11px]">
              <span className="live-dot" aria-hidden />
              ENCORE TOWER · BETA
            </p>
            <p className="title-lockup mt-2 text-[22px] leading-none font-black tracking-[0.06em] sm:text-[32px]">台北安可大樓</p>
            <p className="mt-1.5 hidden text-xs font-black tracking-[0.2em] text-[#ffe9a8] [text-shadow:0_1px_0_#0c0812] sm:block">每一層都是一場台北安可派對</p>
          </header>
          <nav className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 flex gap-1.5" aria-label="大樓選單">
            <a href={BASE} className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm" onClick={() => track('switch_to_tv')}>
              <Tv className="size-3.5" /> 電視模式
            </a>
            <button type="button" className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm" onClick={() => toggleMute()} aria-label={muted ? '開聲音' : '靜音'}>
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
          </nav>
          {mode === 'tower' && <DronePad floors={floors} onEnter={enter} />}
          {mode === 'tower' && <HoverTag floors={floors} />}
          {nearRoof && <RoofChat messages={messages} loading={chatLoading} onPosted={(m) => setMessages((ms) => [m, ...ms.filter((x) => x.id !== m.id)])} />}
        </>
      )}

      {mode === 'gate' && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-end bg-[radial-gradient(ellipse_at_50%_30%,transparent_30%,rgba(0,0,0,0.7))] p-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center">
          <p className="tv-caption text-xs font-black tracking-[0.5em] text-[#ffd400]/90">ENCORE TOWER</p>
          <h2 className="tv-caption mt-2 text-[38px] leading-none font-black tracking-[0.08em] text-[#fff4d6] sm:text-[56px]">台北安可大樓</h2>
          <p className="tv-caption mt-3 max-w-md text-sm leading-relaxed text-[#f3e6bf]/90 sm:text-base">
            一層一場派對，每一層都是一位市民用 AI 做的台北安可舞台。開著無人機繞大樓、飛進窗戶，頂樓花園還能聊天。
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[#ffd400]/80 bg-black/55 px-4 py-1.5 text-sm font-black text-[#ffd400]">
            <Volume2 className="sound-hint-icon size-5 shrink-0" aria-hidden />
            請打開電腦或手機的聲音，效果最好
          </p>
          <button type="button" className="ink-btn gate-pulse mt-4 px-8 py-3 text-xl" data-on="true" onClick={takeOff} disabled={!webgl}>
            ▶ 起飛{deepLink ? `，飛進 ${deepLink} 樓` : ''}
          </button>
          <a href={BASE} className="tv-caption mt-4 text-sm text-white/70 underline underline-offset-4 hover:text-white">
            或改看電視模式：台北安可電視台
          </a>
          <p className="tv-caption mt-3 text-xs text-white/55">iPhone 請關掉靜音模式 · 滾輪／上下滑動飛行 · 點樓層飛進去</p>
        </div>
      )}

      <Guide />
      <SubmitForm unit="樓" />
    </main>
  )
}

function floorFromPathNow() {
  const m = location.pathname.match(/\/tower\/(\d{4,5})\/?$/)
  return m ? Number(m[1]) : null
}
