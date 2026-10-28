import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { track } from '@/lib/analytics'
import { sfx } from '../sfx'
import { useTv, type Slot } from '../store'
import { thumbSources } from './ChannelOverview'

const SEEN_KEY = 'encore.newTicker'
const FRESH_DAYS = 14
/** Shows once per visit, some time into watching, and steps aside on its own. */
const FIRST_MIN_MS = 20_000
const FIRST_SPAN_MS = 40_000
const STAY_MS = 25_000

const createdOf = (s: Slot) => (s.kind === 'live' && s.channel.created_at ? Date.parse(s.channel.created_at) : 0)

/** A one-time 最新上架 news ticker along the bottom of the TV: the newest stage's thumbnail and a crawl; tap to tune in. */
export function NewChannelTicker() {
  const phase = useTv((s) => s.phase)
  const dial = useTv((s) => s.dial)
  const index = useTv((s) => s.index)
  const covered = useTv((s) => s.overviewOpen || s.infoOpen || s.submitOpen || s.guideOpen)
  const [shown, setShown] = useState(false)
  const [img, setImg] = useState(0)

  const slot = useMemo(() => {
    const onAir = dial[index]?.number
    return dial
      .filter((s) => s.kind === 'live' && Date.now() - createdOf(s) < FRESH_DAYS * 864e5 && s.number !== onAir)
      .sort((a, b) => createdOf(b) - createdOf(a))[0]
  }, [dial, index])
  const sources = useMemo(() => (slot ? thumbSources(slot) : []), [slot])

  useEffect(() => {
    if (phase !== 'tv' || sessionStorage.getItem(SEEN_KEY)) return
    let t = 0
    const tryShow = () => {
      const s = useTv.getState()
      if (s.phase !== 'tv') return
      if (s.overviewOpen || s.infoOpen || s.submitOpen || s.guideOpen) {
        t = window.setTimeout(tryShow, 5000)
        return
      }
      sessionStorage.setItem(SEEN_KEY, '1')
      setShown(true)
    }
    t = window.setTimeout(tryShow, FIRST_MIN_MS + Math.random() * FIRST_SPAN_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setShown(false), STAY_MS)
    return () => window.clearTimeout(t)
  }, [shown])

  useEffect(() => {
    if (shown && slot) track('new_ticker_show', { channel: slot.number })
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown || !slot || slot.kind === 'empty' || phase !== 'tv' || covered) return null

  const tune = () => {
    sfx.click()
    track('new_ticker_tune', { channel: slot.number })
    setShown(false)
    useTv.getState().tuneNumber(slot.number)
  }
  const line = `最新上架　第 ${slot.number} 台「${slot.channel.title}」by ${slot.channel.author}　　按這裡馬上轉台 ▶`

  return (
    <div
      className="new-ticker slide-up fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+112px)] z-30 flex h-14 items-stretch overflow-hidden rounded-xl border-2 border-[#0c0812] bg-[#0b1630]/92 shadow-[3px_3px_0_#0c0812] backdrop-blur sm:right-[236px] sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:left-4 sm:h-16"
      role="status"
    >
      <button type="button" onClick={tune} className="flex min-w-0 flex-1 items-stretch text-left" aria-label={`轉到最新上架的第 ${slot.number} 台：${slot.channel.title}`}>
        <span className="flex shrink-0 items-center bg-[#ffd400] px-2.5 text-xs font-black tracking-wider text-[#0c0812] sm:px-3 sm:text-sm">NEW</span>
        <span className="relative aspect-video h-full shrink-0 overflow-hidden bg-[#16306b]">
          {sources[img] && <img src={sources[img]} alt="" className="h-full w-full object-cover" onError={() => setImg((n) => n + 1)} />}
        </span>
        <span className="relative min-w-0 flex-1 overflow-hidden">
          <span className="new-ticker-crawl absolute top-1/2 left-0 -translate-y-1/2 text-sm font-black whitespace-nowrap text-white sm:text-base">
            {[0, 1].map((k) => (
              <span key={k}>
                {line}
                <span className="px-10 text-[#ffd400]">●</span>
              </span>
            ))}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => setShown(false)} className="flex w-10 shrink-0 items-center justify-center text-white/70 hover:bg-white/10 hover:text-white" aria-label="關閉最新上架跑馬燈">
        <X className="size-4" />
      </button>
    </div>
  )
}
