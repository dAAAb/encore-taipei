import { Disc3, ExternalLink, Music2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { applyMusic, mountYouTube } from '@/audio/music'
import { useClub, type MusicMode, type ViewMode } from '@/lib/store'
import { DataSheet } from './DataSheet'

const MUSIC: { id: MusicMode; label: string; icon: typeof Music2 }[] = [
  { id: 'youtube', label: '官方 MV', icon: Music2 },
  { id: 'synth', label: '內建節拍', icon: Disc3 },
  { id: 'off', label: '靜音', icon: VolumeX },
]

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'front', label: '正面' },
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
      className={`ink-card fixed bottom-3 left-3 z-20 w-[min(356px,calc(100vw-24px))] overflow-hidden p-0 transition-opacity ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
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

function PolicyCaption() {
  const speech = useClub((s) => s.speech)
  if (!speech) return null
  return (
    <div
      key={speech.short}
      className="ink-card slide-up fixed right-3 bottom-[228px] z-20 w-[min(420px,calc(100vw-24px))] p-4 sm:bottom-3 md:right-4"
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

  const pickMusic = async (m: MusicMode) => {
    const actual = await applyMusic(m)
    setMode(actual)
  }

  return (
    <>
      <YouTubeCard />
      {started && (
        <>
          <header className="pointer-events-none fixed top-3 left-3 z-20 select-none">
            <p className="neon-title flicker text-3xl leading-none font-black sm:text-4xl">來生</p>
            <p className="mt-1 text-[11px] font-black tracking-[0.32em] text-[#ff8fa3] sm:text-xs">AFTERLIFE · 台北 AI 園區 2033</p>
          </header>

          <nav className="fixed top-3 right-3 z-20 flex max-w-[calc(100vw-120px)] flex-col items-end gap-2" aria-label="場景控制">
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
