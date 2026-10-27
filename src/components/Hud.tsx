import { Disc3, ExternalLink, Music2, PartyPopper, User, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { applyMusic, mountYouTube } from '@/audio/music'
import { TAIPEI_ENCORE_URL } from '@/audio/youtube'
import { useClub, type MusicMode, type ViewMode } from '@/lib/store'
import { TROUPE_CALL, troupeAfter } from '@/scene/troupe-looks'
import { DataSheet } from './DataSheet'
import { EncoreButton, EncoreHint } from './MotionEncore'

const MUSIC: { id: MusicMode; label: string; icon: typeof Music2 }[] = [
  { id: 'youtube', label: '官方 MV', icon: Music2 },
  { id: 'synth', label: '內建節拍', icon: Disc3 },
  { id: 'off', label: '靜音', icon: VolumeX },
]

/** Channel 2028 is this same club opened with the dancers already on stage. */
const TROUPE_CHANNEL = new URLSearchParams(location.search).has('troupe')

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'front', label: '正面' },
  { id: 'close', label: '特寫' },
  { id: 'iso', label: '等角' },
  { id: 'orbit', label: '環繞' },
]

function YouTubeCard() {
  const host = useRef<HTMLDivElement>(null)
  const started = useClub((s) => s.started)
  const mode = useClub((s) => s.musicMode)
  const failed = useClub((s) => s.youtubeFailed)

  useEffect(() => {
    if (host.current!.childElementCount > 0) return
    const el = document.createElement('div')
    host.current!.appendChild(el)
    mountYouTube(el)
  }, [])

  const visible = started && mode === 'youtube' && !failed
  return (
    <div
      className={`ink-card fixed bottom-3 left-3 z-20 w-[240px] overflow-hidden p-0 transition-opacity sm:w-[356px] ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-[#0c0812] bg-[#ffd400] px-3 py-1 text-xs font-black">
        <span className="flex items-center gap-1">
          <Music2 className="size-3.5" /> 正在播放〈台北安可〉官方 MV
        </span>
      </div>
      <div ref={host} className="h-[200px] w-full bg-black" />
    </div>
  )
}

function YouTubeFallback() {
  const started = useClub((s) => s.started)
  const failed = useClub((s) => s.youtubeFailed)
  const mode = useClub((s) => s.musicMode)
  if (!started || !failed) return null
  return (
    <div className="ink-card slide-up fixed bottom-3 left-3 z-20 w-[min(300px,calc(100vw-24px))] p-3 text-xs">
      <p className="font-black">這個瀏覽器無法嵌入播放〈台北安可〉MV</p>
      <p className="mt-1 text-[#4a4f6e]">{mode === 'synth' ? '已改用網站內建的流行龐克節拍。' : '可切換到內建節拍。'}</p>
      <a href={TAIPEI_ENCORE_URL} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-black text-[#1f4fd1] hover:underline">
        到 YouTube 聽官方 MV <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function SoundUnlock() {
  const locked = useClub((s) => s.soundLocked)
  const started = useClub((s) => s.started)
  if (!started || !locked) return null
  return (
    <button
      type="button"
      className="ink-btn fixed animate-pulse bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 px-4 py-2 text-sm sm:text-base"
      data-on="true"
    >
      <Volume2 className="size-4" /> 點一下打開〈台北安可〉聲音
    </button>
  )
}

function PolicyCaption() {
  const speech = useClub((s) => s.speech)
  if (!speech) return null
  return (
    <div
      key={speech.short}
      className="ink-card slide-up fixed right-3 bottom-3 z-20 hidden w-[min(420px,calc(100vw-400px))] min-w-[280px] p-4 md:right-4 md:block"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2 py-0.5 text-[11px] font-black">{speech.tag}</span>
        <span className="text-[11px] font-black tracking-widest text-[#c8234a]">蔣萬安 · 黃金十年政見</span>
      </div>
      <p className="mt-2 text-lg leading-snug font-black">{speech.short}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#2a2f52]">{speech.detail}</p>
      {speech.source ? (
        <a href={speech.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#1f4fd1] hover:underline">
          資料來源 <ExternalLink className="size-3" />
        </a>
      ) : (
        <span className="mt-1 inline-block text-xs text-[#6a6f8e]">資料來源：競選文宣</span>
      )}
    </div>
  )
}

export function Hud() {
  const started = useClub((s) => s.started)
  const mode = useClub((s) => s.musicMode)
  const setMode = useClub((s) => s.setMusicMode)
  const view = useClub((s) => s.view)
  const setView = useClub((s) => s.setView)
  const ytFailed = useClub((s) => s.youtubeFailed)

  const setWant = useClub((s) => s.setWantMusic)
  const troupe = useClub((s) => s.troupeMode)
  const nextTroupe = useClub((s) => s.nextTroupe)
  const setTroupe = useClub((s) => s.setTroupe)
  const remoteControls = useClub((s) => s.remoteControls)

  const pickMusic = async (m: MusicMode) => {
    setWant(m)
    const actual = await applyMusic(m)
    setMode(actual)
  }

  return (
    <>
      <YouTubeCard />
      <YouTubeFallback />
      <SoundUnlock />
      {started && (
        <>
          <header className="pointer-events-none fixed top-3 left-3 z-20 select-none">
            <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2 py-px text-[10px] font-black tracking-[0.14em] text-[#0c0812] shadow-[2px_2px_0_#0c0812] sm:text-[11px]">
              <span className="live-dot" aria-hidden />
              LIVE · 2033<span className="hidden sm:inline"> 台北 AI 園區</span>
            </p>
            <p className="title-lockup mt-2 text-[22px] leading-none font-black tracking-[0.06em] sm:text-[34px]">{TROUPE_CHANNEL ? '台北安可大舞團' : '台北安可之夜'}</p>
            <p className="mt-2 hidden text-xs font-black tracking-[0.2em] text-[#ffe9a8] [text-shadow:0_1px_0_#0c0812,0_0_10px_rgba(255,42,77,0.65)] sm:block">
              {TROUPE_CHANNEL ? '蔣萬安 × 可愛動物 × 市民朋友' : '蔣萬安 · 黃金十年 3D 派對'}
            </p>
          </header>

          <nav
            className={`fixed top-3 right-3 z-20 flex max-w-[calc(100vw-150px)] flex-col items-end gap-2 sm:max-w-[calc(100vw-120px)] ${remoteControls ? 'hidden' : ''}`}
            aria-label="場景控制"
          >
            <div className="flex flex-wrap justify-end gap-1.5">
              {MUSIC.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs disabled:opacity-50 sm:text-sm"
                  data-on={mode === id}
                  disabled={id === 'youtube' && ytFailed}
                  title={id === 'youtube' && ytFailed ? 'YouTube 無法載入，已改用內建節拍' : undefined}
                  onClick={() => pickMusic(id)}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {VIEWS.map(({ id, label }) => (
                <button key={id} type="button" className="ink-btn px-2.5 py-1 text-xs sm:text-sm" data-on={view === id} onClick={() => setView(id)}>
                  {label}
                </button>
              ))}
              <DataSheet />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <EncoreButton />
              <button
                type="button"
                className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm"
                data-on={troupe !== 'solo'}
                onClick={nextTroupe}
                title={`${TROUPE_CALL[troupeAfter(troupe)].full}（鍵盤 D）`}
              >
                <PartyPopper className="size-3.5" /> {TROUPE_CALL[troupeAfter(troupe)].full}
              </button>
              {troupe !== 'solo' && (
                <button type="button" className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm" onClick={() => setTroupe('solo')} title="只留市長獨舞">
                  <User className="size-3.5" /> 獨舞
                </button>
              )}
            </div>
            <EncoreHint />
          </nav>

          <PolicyCaption />

          <p className="pointer-events-none fixed bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 text-[10px] text-white/45 lg:block">
            粉絲創作 · 非競選團隊官方網站 · 資料出處見「政績資料」
          </p>
        </>
      )}
    </>
  )
}
