import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Clapperboard, Volume2 } from 'lucide-react'
import { track } from '@/lib/analytics'
import { edgeSmoother, rgbHex, setPageEdgeColor, type Rgb } from '@/lib/page-edge'
import { FIRST_CHANNEL, fetchLiveChannels, type Channel } from './channel-data'
import { ChannelOverview } from './components/ChannelOverview'
import { ChannelScreen } from './components/ChannelScreen'
import { DuoPairPanel } from './duo/DuoPairPanel'
import { useWakeLock } from './duo/link'
import { DUO_MODE, tvRoom } from './duo/mode'
import type { Command } from './duo/protocol'
import { RemotePad, type PadActions } from './duo/RemotePad'
import { colorKey, openSubmitPage, shareChannel, stageCommand, useLocalPadState } from './duo/tvControl'
import { useDuoTv } from './duo/useDuoTv'
import { useSplit } from './duo/useSplit'
import { Guide } from './components/Guide'
import { InfoSheet } from './components/InfoSheet'
import { Osd } from './components/Osd'
import { Remote } from './components/Remote'
import { SubmitForm } from './components/SubmitForm'
import { loadNarrationDurations } from './montage/narrator'
import { aliasFromPage, deepLinkFromPage, syncUrl } from './routing'
import { pickLayout } from './scene/layouts'
import { RoomStage } from './scene/RoomStage'
import { sfx } from './sfx'
import { useTv } from './store'

const Finale = lazy(() => import('./finale/Finale'))
const BASE = import.meta.env.BASE_URL

function detectWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** How much the gate's vignette darkens the bottom of the room (measured on an iPhone screenshot). */
const GATE_SHADE = 0.57
/** Bottom of the full-size remote (.duo-pad), so Safari's bar continues it in ?duo. */
const PAD_BOTTOM = '#121116'
const SAMPLE_EDGE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
const SHOW_DEBUG = new URLSearchParams(location.search).has('debug')

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function TvApp() {
  const phase = useTv((s) => s.phase)
  const setPhase = useTv((s) => s.setPhase)
  const deepLink = useTv((s) => s.deepLink)
  const [durations, setDurations] = useState<number[] | null>(null)
  const [quick, setQuick] = useState(false)
  const [fading, setFading] = useState(false)
  const [subtitle, setSubtitle] = useState<string | null>(null)
  const [layout, setLayout] = useState(() => pickLayout())
  const [arriving, setArriving] = useState(0)
  const [entry, setEntry] = useState('')
  const entryTimer = useRef(0)
  const webgl = useMemo(detectWebGL, [])
  const lowPower = useMemo(() => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4, [])

  useEffect(() => {
    const n = deepLinkFromPage()
    if (n) useTv.setState({ deepLink: n })
    loadNarrationDurations().then(setDurations)
    const alias = aliasFromPage()
    const apply = (rows: Channel[]) => {
      const moved = alias?.id ? rows.find((r) => r.id === alias.id)?.channel : undefined
      if (moved && moved !== useTv.getState().deepLink) useTv.setState({ deepLink: moved })
      useTv.getState().setChannels(rows)
      const s = useTv.getState()
      if (s.deepLink && s.phase !== 'tv') s.tuneNumber(s.deepLink)
    }
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

  useEffect(() => {
    if (phase !== 'tv') return
    const sync = () => {
      const s = useTv.getState()
      const slot = s.dial[s.index]
      if (!slot) return
      const title = slot.kind === 'empty' ? '訊號徵求中' : slot.channel.title
      syncUrl(slot.number, `第 ${slot.number} 台｜${title}｜台北安可大舞台`)
    }
    sync()
    return useTv.subscribe((s, prev) => {
      if (s.index !== prev.index || s.dial !== prev.dial) sync()
    })
  }, [phase])

  const digit = useCallback((d: number) => {
    window.clearTimeout(entryTimer.current)
    setEntry((e) => {
      const next = (e + d).slice(-5)
      const commit = (value: string) => {
        if (!useTv.getState().tuneNumber(Number(value))) useTv.setState((s) => ({ osdNonce: s.osdNonce + 1, osdKind: 'channel' }))
        setEntry('')
      }
      if (next.length >= 4) entryTimer.current = window.setTimeout(() => commit(next), 900)
      else entryTimer.current = window.setTimeout(() => commit(next), 2200)
      return next
    })
  }, [])

  // The tube switches off on the picture that is on screen, so it shows however long the finale takes to load.
  const [crtOff, setCrtOff] = useState(false)
  const offTimer = useRef(0)
  const powerOff = useCallback(() => {
    if (offTimer.current) return
    sfx.powerOff()
    useTv.setState({ infoOpen: false, submitOpen: false, guideOpen: false })
    void import('./finale/Finale').catch(() => {})
    setCrtOff(true)
    offTimer.current = window.setTimeout(() => {
      offTimer.current = 0
      setCrtOff(false)
      setPhase('off')
      syncUrl(null)
    }, 600)
  }, [setPhase])
  useEffect(() => () => window.clearTimeout(offTimer.current), [])

  useEffect(() => {
    if (phase !== 'tv') return
    const t = window.setTimeout(() => void import('./finale/Finale').catch(() => {}), 8000)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'tv') return
    const handle = (key: string) => {
      const s = useTv.getState()
      if (s.submitOpen || s.guideOpen || s.overviewOpen) return false
      switch (key) {
        case 'g':
        case 'G':
          s.setInfoOpen(false)
          s.setOverviewOpen(true)
          return true
        case 'ArrowRight':
        case 'ArrowUp':
        case 'PageUp':
          s.step(1)
          return true
        case 'ArrowLeft':
        case 'ArrowDown':
        case 'PageDown':
          s.step(-1)
          return true
        case '+':
        case '=':
          s.setVolume(s.volume + 5)
          return true
        case '-':
        case '_':
          s.setVolume(s.volume - 5)
          return true
        case 'm':
        case 'M':
          s.toggleMute()
          return true
        case 'i':
        case 'I':
          s.setInfoOpen(!s.infoOpen)
          return true
        default:
          if (/^[0-9]$/.test(key)) {
            digit(Number(key))
            return true
          }
          return false
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (handle(e.key)) e.preventDefault()
    }
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; key?: string } | null
      if (data?.type === 'encore:key' && typeof data.key === 'string') handle(data.key)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('message', onMessage)
    }
  }, [phase, digit])

  const powerOn = async (fast: boolean) => {
    // A paired remote can switch the TV on without a tap here; Safari then never resumes audio, so do not wait on it.
    await Promise.race([sfx.unlock(), new Promise((r) => window.setTimeout(r, 400))])
    sfx.powerOn()
    const s = useTv.getState()
    if (s.deepLink) s.tuneNumber(s.deepLink)
    else s.tune(0)
    setQuick(fast)
    setPhase(webgl ? 'intro' : 'tv')
  }

  const introDone = useCallback(() => {
    setFading(true)
    setPhase('tv')
    window.setTimeout(() => setFading(false), 900)
  }, [setPhase])

  // Through the slit the show carries straight on: back in the room, the set switches itself on.
  const [resuming, setResuming] = useState(false)
  const powerOnRef = useRef(powerOn)
  useEffect(() => {
    powerOnRef.current = powerOn
  })
  const resumeTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])
  const backFromSpace = useCallback(() => {
    useTv.setState({ deepLink: null })
    setLayout((l) => pickLayout(l.id))
    setQuick(false)
    setArriving((n) => n + 1)
    setResuming(true)
    setPhase('gate')
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => {
      setResuming(false)
      if (useTv.getState().phase === 'gate') void powerOnRef.current(false)
    }, 1500)
  }, [setPhase])

  const roomVisible = phase === 'gate' || phase === 'intro' || fading
  const roomMode = phase === 'gate' ? 'gate' : 'intro'

  const [duoRoom] = useState(() => (DUO_MODE === 'tv' ? tvRoom() : null))
  const applyCommand = (c: Command) => {
    const s = useTv.getState()
    if (c.k === 'power') {
      if (s.phase === 'gate' && durations) powerOn(true)
      else if (s.phase === 'intro') introDone()
      else if (s.phase === 'tv') powerOff()
      return
    }
    if (s.phase !== 'tv') return
    if (c.k === 'step') s.step(c.d)
    else if (c.k === 'tune') s.tuneNumber(c.n)
    else if (c.k === 'digit') digit(c.d)
    else if (c.k === 'vol') s.setVolume(s.volume + c.d)
    else if (c.k === 'mute') s.toggleMute()
    else if (c.k === 'info') s.setInfoOpen(!s.infoOpen)
    else if (c.k === 'color') colorKey(c.c)
    else if (c.k === 'stage') stageCommand(c)
  }
  const duo = useDuoTv(duoRoom, entry, applyCommand)
  useWakeLock(DUO_MODE === 'tv' || DUO_MODE === 'split')
  useEffect(() => {
    if (DUO_MODE) track('duo_open', { mode: DUO_MODE })
  }, [])

  const split = useSplit(DUO_MODE === 'split' && phase === 'tv')

  const edge = useRef({ room: null as Rgb | null, smooth: edgeSmoother(), phase, split: false })
  const paintEdge = useCallback(() => {
    const e = edge.current
    if ((e.phase === 'gate' || e.phase === 'intro') && e.room) setPageEdgeColor(rgbHex(e.room, e.phase === 'gate' ? GATE_SHADE : 1))
    else if (e.phase === 'tv' && e.split) setPageEdgeColor(PAD_BOTTOM)
    else setPageEdgeColor(null)
  }, [])
  const onEdgeColor = useCallback(
    (rgb: Rgb) => {
      edge.current.room = edge.current.smooth(rgb)
      paintEdge()
    },
    [paintEdge],
  )
  useEffect(() => {
    edge.current.phase = phase
    edge.current.split = split.active
    paintEdge()
  }, [phase, split.active, paintEdge])
  useEffect(() => () => setPageEdgeColor(null), [])
  const padState = useLocalPadState(entry)
  const padActions: PadActions = {
    step: (d) => useTv.getState().step(d),
    tune: (n) => useTv.getState().tuneNumber(n),
    digit,
    vol: (d) => useTv.getState().setVolume(useTv.getState().volume + d),
    mute: () => useTv.getState().toggleMute(),
    info: () => useTv.getState().setInfoOpen(!useTv.getState().infoOpen),
    upload: () => openSubmitPage('duo_remote'),
    color: colorKey,
    stage: stageCommand,
    power: powerOff,
    share: () => void shareChannel(padState.n, 'duo_split'),
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <h1 className="sr-only">台北安可大舞台 ENCORE.TAIPEI：轉台看每一位市民用 AI 做的安可政策大舞台</h1>

      {phase === 'tv' && (
        <>
          <div className={`fixed inset-x-0 top-0 ${crtOff ? 'crt-off' : ''}`} style={split.active ? { height: split.tv } : { bottom: 0 }}>
            <ChannelScreen />
            <Osd />
          </div>
          {crtOff && <div className="crt-line pointer-events-none fixed inset-x-0 top-0 z-40" style={split.active ? { height: split.tv } : { bottom: 0 }} aria-hidden />}
          {split.active ? (
            <>
              <div
                className="duo-gutter fixed inset-x-0 z-10 cursor-row-resize"
                style={{ top: split.tv, height: split.gutter }}
                onPointerDown={split.onGutterDown}
                onDoubleClick={split.reset}
                role="separator"
                aria-orientation="horizontal"
                aria-label="拖曳調整電視和遙控器的大小，點兩下恢復"
              />
              {SHOW_DEBUG && (
                <p className="pointer-events-none fixed top-1 left-1 z-50 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-[#b6ffb0]">{split.debug}</p>
              )}
              <div className="fixed inset-x-0 bottom-0 z-10" style={{ top: split.tv + split.gutter }}>
                <RemotePad state={padState} actions={padActions} insetTop={false} />
              </div>
            </>
          ) : (
            DUO_MODE !== 'tv' && <Remote onPowerOff={powerOff} entry={entry} onDigit={digit} />
          )}
          {duoRoom && <DuoPairPanel room={duoRoom} status={duo.status} remotes={duo.remotes} joins={duo.joins} />}
          <ChannelOverview />
          <InfoSheet />
          <SubmitForm />
          <Guide />
        </>
      )}

      {webgl && roomVisible && durations && (
        <div className={`fixed inset-0 z-20 transition-opacity duration-700 ${phase === 'tv' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <RoomStage
            mode={roomMode}
            layout={layout}
            quick={quick}
            durations={durations}
            onDone={introDone}
            lowPower={lowPower}
            onTvClick={phase === 'gate' && durations ? () => powerOn(true) : undefined}
            onEdgeColor={SAMPLE_EDGE || DUO_MODE ? onEdgeColor : undefined}
            onSubtitle={setSubtitle}
          />
        </div>
      )}

      {phase === 'intro' && !fading && subtitle && (
        <p
          key={subtitle}
          className="intro-subtitle pointer-events-none fixed inset-x-0 bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.5rem))] z-30 mx-auto w-fit max-w-[min(92vw,44rem)] rounded-lg bg-black/60 px-4 py-1.5 text-center text-[19px] leading-snug font-bold tracking-[0.04em] text-white sm:text-[24px]"
          aria-live="polite"
        >
          {subtitle}
        </p>
      )}

      {phase === 'off' && (
        <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
          <Finale onDone={backFromSpace} lowPower={lowPower} />
        </Suspense>
      )}

      {phase === 'gate' && !resuming && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-end bg-[radial-gradient(ellipse_at_50%_35%,transparent_30%,rgba(0,0,0,0.65))] p-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center">
          <p className="tv-caption text-xs font-black tracking-[0.5em] text-[#ffd400]/90">ENCORE.TAIPEI</p>
          <h2 className="tv-caption mt-2 text-[34px] leading-none font-black tracking-[0.08em] text-[#fff4d6] sm:text-[52px]">台北安可大舞台</h2>
          <p className="tv-caption mt-3 max-w-md text-sm leading-relaxed text-[#f3e6bf]/85 sm:text-base">每一台，都是一位市民用 AI 做的安可政策大舞台。</p>
          <p className="sound-hint mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[#ffd400]/80 bg-black/55 px-4 py-1.5 text-sm font-black text-[#ffd400] sm:text-base">
            <Volume2 className="sound-hint-icon size-5 shrink-0" aria-hidden />
            請打開電腦或手機的聲音，效果最好
          </p>
          <button
            type="button"
            className="ink-btn gate-pulse mt-4 px-8 py-3 text-xl"
            data-on="true"
            disabled={!durations}
            onClick={() => powerOn(true)}
          >
            ▶ 打開電視 · 第 {deepLink ?? FIRST_CHANNEL} 台
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="gate-chip" onClick={() => powerOn(false)}>
              <Clapperboard className="size-4 shrink-0 text-white/70" aria-hidden />
              從頭看開場・台北安可新聞特輯
            </button>
            <a href={`${BASE}tower/`} className="gate-chip">
              <Building2 className="size-4 shrink-0 text-[#ffd400]" aria-hidden />
              <span className="text-[#ffd400]">新玩法</span>搭無人機逛台北安可大樓
            </a>
          </div>
          {DUO_MODE === 'tv' && (
            <p className="tv-caption mt-3 max-w-sm text-sm font-bold text-[#b6ffb0]">電視模式：打開後，用另一支手機掃畫面上的 QR code 當遙控器。</p>
          )}
          <p className="tv-caption mt-4 text-xs text-white/55">iPhone 請關掉靜音模式 · 鍵盤 ← → 轉台</p>
          <p className="tv-caption mt-2 text-[11px] text-white/45">
            粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站 ·{' '}
            <a href="https://github.com/dAAAb/encore-taipei" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
              原始碼
            </a>
          </p>
          <p className="tv-caption fixed bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-3 font-mono text-[10px] tracking-widest text-white/35" title={layout.name}>
            後室 {layout.id}
          </p>
        </div>
      )}

      {arriving > 0 && <div key={arriving} className="arrive-flash pointer-events-none fixed inset-0 z-50 bg-white" />}

      {phase === 'intro' && !fading && (
        <button
          type="button"
          className="tv-caption fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-sm text-white/80 backdrop-blur hover:bg-black/60"
          onClick={introDone}
        >
          略過 ▶▶
        </button>
      )}

    </main>
  )
}
