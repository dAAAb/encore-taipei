import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { fetchLiveChannels, type Channel } from './channel-data'
import { ChannelScreen } from './components/ChannelScreen'
import { Guide } from './components/Guide'
import { InfoSheet } from './components/InfoSheet'
import { Osd } from './components/Osd'
import { Remote } from './components/Remote'
import { SubmitForm } from './components/SubmitForm'
import { loadNarrationDurations } from './montage/narrator'
import { channelFromPath, syncUrl } from './routing'
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

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function TvApp() {
  const phase = useTv((s) => s.phase)
  const setPhase = useTv((s) => s.setPhase)
  const deepLink = useTv((s) => s.deepLink)
  const [durations, setDurations] = useState<number[] | null>(null)
  const [quick, setQuick] = useState(false)
  const [fading, setFading] = useState(false)
  const [layout, setLayout] = useState(() => pickLayout())
  const [arriving, setArriving] = useState(0)
  const [entry, setEntry] = useState('')
  const entryTimer = useRef(0)
  const webgl = useMemo(detectWebGL, [])
  const lowPower = useMemo(() => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4, [])

  useEffect(() => {
    const n = channelFromPath()
    if (n) useTv.setState({ deepLink: n })
    loadNarrationDurations().then(setDurations)
    const apply = (rows: Channel[]) => {
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
      syncUrl(slot.number, `第 ${slot.number} 台｜${title}｜台北安可電視台`)
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

  const powerOff = useCallback(() => {
    sfx.powerOff()
    useTv.setState({ infoOpen: false, submitOpen: false, guideOpen: false })
    setPhase('off')
    syncUrl(null)
  }, [setPhase])

  useEffect(() => {
    if (phase !== 'tv') return
    const handle = (key: string) => {
      const s = useTv.getState()
      if (s.submitOpen || s.guideOpen) return false
      switch (key) {
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
    await sfx.unlock()
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

  const backFromSpace = useCallback(() => {
    useTv.setState({ deepLink: null })
    setLayout((l) => pickLayout(l.id))
    setQuick(false)
    setArriving((n) => n + 1)
    setPhase('gate')
  }, [setPhase])

  const roomVisible = phase === 'gate' || phase === 'intro' || fading
  const roomMode = phase === 'gate' ? 'gate' : 'intro'

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <h1 className="sr-only">台北安可電視台 ENCORE.TAIPEI：轉台看每個人做的台北安可舞台</h1>

      {phase === 'tv' && (
        <>
          <ChannelScreen />
          <Osd />
          <Remote onPowerOff={powerOff} entry={entry} onDigit={digit} />
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
            onTvClick={phase === 'gate' && durations ? () => powerOn(!!deepLink) : undefined}
          />
        </div>
      )}

      {phase === 'off' && (
        <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
          <Finale onDone={backFromSpace} lowPower={lowPower} />
        </Suspense>
      )}

      {phase === 'gate' && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-end bg-[radial-gradient(ellipse_at_50%_35%,transparent_30%,rgba(0,0,0,0.65))] p-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center">
          <p className="tv-caption text-xs font-black tracking-[0.5em] text-[#ffd400]/90">ENCORE.TAIPEI</p>
          <h2 className="tv-caption mt-2 text-[34px] leading-none font-black tracking-[0.08em] text-[#fff4d6] sm:text-[52px]">台北安可電視台</h2>
          <p className="tv-caption mt-3 max-w-md text-sm leading-relaxed text-[#f3e6bf]/85 sm:text-base">
            空房間裡有一台電視。每一台，都是一位市民用 AI 做的台北安可舞台。
          </p>
          <p className="sound-hint mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[#ffd400]/80 bg-black/55 px-4 py-1.5 text-sm font-black text-[#ffd400] sm:text-base">
            <Volume2 className="sound-hint-icon size-5 shrink-0" aria-hidden />
            請打開電腦或手機的聲音，效果最好
          </p>
          <button
            type="button"
            className="ink-btn gate-pulse mt-4 px-8 py-3 text-xl"
            data-on="true"
            disabled={!durations}
            onClick={() => powerOn(!!deepLink)}
          >
            ▶ 打開電視{deepLink ? ` · 第 ${deepLink} 台` : ''}
          </button>
          {!deepLink && (
            <button type="button" className="tv-caption mt-4 text-sm text-white/70 underline underline-offset-4 hover:text-white" onClick={() => powerOn(true)}>
              略過開場，直接轉到第 2026 台
            </button>
          )}
          <a href={`${BASE}tower/`} className="tv-caption mt-3 text-sm font-bold text-[#ffd400]/90 underline underline-offset-4 hover:text-[#ffd400]">
            新玩法：搭無人機逛「台北安可大樓」→
          </a>
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
