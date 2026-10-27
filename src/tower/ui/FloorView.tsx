import { ArrowDown, ArrowUp, Cloud, CloudOff, LogOut, Sparkles, Upload, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { OnboardAgent } from '@/tv/components/OnboardAgent'
import { postStageVolume, stageFrameUrl, SUBMIT_PATH } from '@/tv/routing'
import { sfx } from '@/tv/sfx'
import { useTv } from '@/tv/store'
import { floorTitle, type Floor } from '../layout'
import { ding } from '../sfx'
import { useTower } from '../store'

const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-pointer-lock allow-presentation allow-downloads allow-modals'
const ALLOW = 'autoplay; fullscreen; clipboard-write; encrypted-media; gyroscope; accelerometer; xr-spatial-tracking; web-share'

const floorKey = (f: Floor | undefined) => (f ? `${f.index}:${f.kind === 'slot' ? `${f.slot.kind}:${'channel' in f.slot ? f.slot.channel.url : ''}` : 'future'}` : '')

function Vacant({ floor, next }: { floor: Floor; next: number }) {
  const setGuideOpen = useTv((s) => s.setGuideOpen)
  const setSubmitOpen = useTv((s) => s.setSubmitOpen)
  const future = floor.kind === 'future'
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_20%,#4a3a18,#14120c_60%,#07060a)] p-4">
      <div className="ink-card slide-up w-full max-w-md p-5 text-center sm:p-7">
        <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2.5 py-0.5 text-[11px] font-black tracking-[0.16em] text-[#0c0812]">
          {floor.number}F · FOR LEASE
        </p>
        <h2 className="mt-3 text-[34px] leading-none font-black tracking-[0.04em] sm:text-[40px]">{future ? '即將開放' : '招租中'}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#2a2f52]">
          {future ? (
            <>
              這層還在等。先從 <b>{next} 樓</b>開始：用 AI 做一座你自己的台北安可派對，送出後馬上就能在那一層預覽。
            </>
          ) : (
            <>
              <b>{floor.number} 樓</b>還空著，可以是你的。用 AI 做一座你自己的台北安可派對，送出後馬上就能在這一層預覽。
            </>
          )}
        </p>
        <div className="mt-5 grid gap-2.5">
          <button type="button" className="ink-btn flex items-center justify-center gap-2 px-5 py-2.5 text-base" data-on="true" onClick={() => setSubmitOpen(true)}>
            <Upload className="size-4" /> 我做好了，上架第 {next} 樓
          </button>
          <button type="button" className="ink-btn flex items-center justify-center gap-2 px-5 py-2.5 text-base" onClick={() => setGuideOpen(true)}>
            <Sparkles className="size-4" /> 怎麼做？給我 prompt
          </button>
          <OnboardAgent className="mt-1" />
        </div>
          <p className="mt-4 text-xs text-[#6a6f8e]">
            也可以把上架頁分享給朋友：
            <a href={SUBMIT_PATH} className="font-black text-[#1f4fd1] underline underline-offset-2">
              {location.host}
              {SUBMIT_PATH}
            </a>
          </p>
      </div>
    </div>
  )
}

/** Inside a floor: the stage itself, misty at the edges; changing floors rides the elevator. */
export function FloorView({ floors, next, onLeave, onStep }: { floors: Floor[]; next: number; onLeave: () => void; onStep: (d: number) => void }) {
  const active = useTower((s) => s.active)
  const mist = useTower((s) => s.mist)
  const setMist = useTower((s) => s.setMist)
  const volume = useTv((s) => s.volume)
  const muted = useTv((s) => s.muted)
  const toggleMute = useTv((s) => s.toggleMute)
  const setPending = useTv((s) => s.setPending)
  const floor = floors[active]
  const [shown, setShown] = useState<Floor | undefined>(floor)
  const [shut, setShut] = useState(false)
  const [visible, setVisible] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const first = useRef(true)
  const key = floorKey(floor)

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 30)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setShut(true)
    ding()
    const swap = window.setTimeout(() => setShown(floors[useTower.getState().active]), 520)
    const open = window.setTimeout(() => setShut(false), 1500)
    return () => {
      window.clearTimeout(swap)
      window.clearTimeout(open)
    }
  }, [key])

  useEffect(() => {
    const url = shown?.kind === 'slot' && 'channel' in shown.slot ? shown.slot.channel.url : null
    if (url) postStageVolume(frame.current?.contentWindow, url, volume / 100, muted)
  }, [volume, muted, shown])

  const slot = shown?.kind === 'slot' ? shown.slot : null
  const stage = slot && slot.kind !== 'empty' ? slot : null
  const atTop = active >= floors.findLastIndex((f) => f.kind === 'slot')

  return (
    <div className={`fixed inset-0 z-10 bg-black transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {stage ? (
        <iframe
          key={floorKey(shown)}
          ref={frame}
          src={stageFrameUrl(stage.channel.url)}
          title={`${shown!.number} 樓：${stage.channel.title}`}
          className="absolute inset-0 h-full w-full border-0"
          allow={ALLOW}
          allowFullScreen
          sandbox={SANDBOX}
          onLoad={() => postStageVolume(frame.current?.contentWindow, stage.channel.url, volume / 100, muted)}
        />
      ) : (
        shown && <Vacant floor={shown} next={next} />
      )}
      {stage && <div className="floor-mist" style={{ opacity: mist ? 1 : 0 }} />}
      {stage && mist && <div className="floor-glint" />}

      {slot?.kind === 'pending' && (
        <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 z-20 w-[min(92vw,640px)] -translate-x-1/2">
          <div className="ink-card flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <p className="flex-1 leading-snug">
              <b className="text-[#c8234a]">審核中・只有你看得到這一層。</b>
              管理員通過後才會正式上架，樓層可能會變動。
            </p>
            <button type="button" className="ink-btn shrink-0 px-3 py-1 text-xs" onClick={() => setPending(null)}>
              撤回預覽
            </button>
          </div>
        </div>
      )}

      <div className={shut ? 'elevator-shut' : ''}>
        <div className="elevator-door elevator-door--l" />
        <div className="elevator-door elevator-door--r" />
      </div>

      <div className="drone-pad fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 p-2 text-white sm:right-4">
        <div className="flex min-w-[6.5rem] flex-col items-center rounded-xl border-2 border-[#0c0812] bg-[#0b0a10] px-2 py-1.5">
          <span className="elevator-digits">{floor ? `${floor.number}F` : ''}</span>
          <span className="max-w-[8rem] truncate text-[11px] font-bold text-[#fff4d6]">{floor ? floorTitle(floor) : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className="pad-key size-10" aria-label={atTop ? '上頂樓花園' : '上一層樓'} title={atTop ? '上頂樓花園' : '上一層樓'} onClick={() => onStep(1)}>
            <ArrowUp className="size-5" />
          </button>
          <button
            type="button"
            className="pad-key size-10"
            aria-label={muted ? '開聲音' : '靜音'}
            title={muted ? '開聲音' : '靜音'}
            onClick={() => {
              sfx.click()
              toggleMute()
            }}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button type="button" className="pad-key size-10" aria-label="下一層樓" title="下一層樓" disabled={active <= 0} onClick={() => onStep(-1)}>
            <ArrowDown className="size-5" />
          </button>
          <button
            type="button"
            className="pad-key size-10"
            aria-label={mist ? '關掉窗邊薄霧' : '打開窗邊薄霧'}
            title={mist ? '關掉窗邊薄霧' : '打開窗邊薄霧'}
            onClick={() => {
              sfx.click()
              setMist(!mist)
            }}
          >
            {mist ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
          </button>
        </div>
        <button type="button" className="ink-btn flex h-[5.4rem] w-[4.6rem] flex-col items-center justify-center gap-1 px-1 text-xs leading-tight" data-on="true" onClick={onLeave}>
          <LogOut className="size-5" />
          飛出
          <br />
          大樓
        </button>
      </div>
    </div>
  )
}
