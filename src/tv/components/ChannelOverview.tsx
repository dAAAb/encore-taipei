import { ArrowUpDown, Info, LayoutGrid, Play, Search, Share2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { track } from '@/lib/analytics'
import { toLastSlot, shareChannel } from '../duo/tvControl'
import { sfx } from '../sfx'
import { useTv, type Slot } from '../store'
import { youtubeId } from '../youtube'

const BASE = import.meta.env.BASE_URL
const NEW_DAYS = 7
const NEW_COUNT = 3

type Sort = 'number' | 'newest'

const titleOf = (s: Slot) => (s.kind === 'empty' ? '訊號徵求中' : s.channel.title)
const authorOf = (s: Slot) => (s.kind === 'empty' ? '' : s.channel.author)
const createdOf = (s: Slot) => (s.kind === 'live' && s.channel.created_at ? Date.parse(s.channel.created_at) : 0)

/** Clean guide still, then the share image, the stage's own preview, the text card; null shows a title tile. */
function thumbSources(s: Slot): string[] {
  if (s.kind === 'empty') return []
  const own = s.channel.og_image?.startsWith('https://') ? [s.channel.og_image] : []
  if (s.kind === 'pending') return own
  return [`${BASE}thumbs/${s.number}.jpg`, `${BASE}og/${s.number}.jpg`, ...own, `${BASE}og/${s.number}.png`]
}

function Thumb({ slot, className = '' }: { slot: Slot; className?: string }) {
  const sources = useMemo(() => thumbSources(slot), [slot])
  const [i, setI] = useState(0)
  if (slot.kind === 'empty') {
    return (
      <div className={`overview-bars relative ${className}`} aria-hidden>
        <span className="absolute inset-x-[18%] top-1/2 -translate-y-1/2 rounded-md bg-black/80 py-1.5 text-center text-sm font-black text-white">訊號徵求中</span>
      </div>
    )
  }
  const src = sources[i]
  return src ? (
    <img src={src} alt="" loading="lazy" draggable={false} className={`object-cover ${className}`} onError={() => setI((n) => n + 1)} />
  ) : (
    <div className={`flex items-center justify-center bg-[#16306b] p-3 text-center text-sm font-black text-white/85 ${className}`}>{titleOf(slot)}</div>
  )
}

function Badges({ slot, current, fresh }: { slot: Slot; current: boolean; fresh: boolean }) {
  const yt = slot.kind !== 'empty' && youtubeId(slot.channel.url)
  return (
    <span className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
      {current && (
        <span className="overview-badge bg-[#ff2a4d] text-white">
          <i className="live-dot" aria-hidden />
          <span className="hidden sm:inline">播放中</span>
        </span>
      )}
      {slot.kind === 'pending' && <span className="overview-badge bg-[#ffd400] text-[#0c0812]">審核中・只有你看得到</span>}
      {fresh && (
        <span className="overview-badge bg-[#b6ffb0] text-[#0c0812]">
          新<span className="hidden sm:inline">上架</span>
        </span>
      )}
      {yt && (
        <span className="overview-badge bg-black/75 text-white">
          ▶<span className="hidden sm:inline"> 影片</span>
        </span>
      )}
    </span>
  )
}

/**
 * Every channel at a glance, floating over the TV (which keeps playing, dimmed): the one on air as a banner,
 * then a scrollable grid of thumbnails. Arrow keys move, Enter tunes, / searches, Esc or G closes.
 */
export function ChannelOverview() {
  const open = useTv((s) => s.overviewOpen)
  const setOpen = useTv((s) => s.setOverviewOpen)
  const dial = useTv((s) => s.dial)
  const index = useTv((s) => s.index)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('number')
  const grid = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const current = dial[index]
  const now = useTv((s) => s.overviewAt)
  const liveCount = dial.filter((s) => s.kind === 'live').length
  const newest = useMemo(
    () =>
      new Set(
        dial
          .filter((s) => s.kind === 'live' && now - createdOf(s) < NEW_DAYS * 864e5)
          .sort((a, b) => createdOf(b) - createdOf(a))
          .slice(0, NEW_COUNT)
          .map((s) => s.number),
      ),
    [dial, now],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (s: Slot) =>
      !q || String(s.number).includes(q) || titleOf(s).toLowerCase().includes(q) || authorOf(s).toLowerCase().includes(q)
    const list = dial.filter((s) => s.kind !== 'empty' && hit(s))
    if (sort === 'newest') list.sort((a, b) => createdOf(b) - createdOf(a) || b.number - a.number)
    const empty = dial.find((s) => s.kind === 'empty')
    return empty && !q ? [...list, empty] : list
  }, [dial, query, sort])

  useEffect(() => {
    if (!open) return
    track('overview_open', { channel: current?.number })
    const t = window.setTimeout(() => grid.current?.querySelector<HTMLElement>('[data-current="true"]')?.focus({ preventScroll: true }), 60)
    return () => window.clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !current) return null

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const pick = (s: Slot) => {
    sfx.click()
    track('overview_pick', { channel: s.number, from: current.number })
    close()
    if (s.kind === 'empty') toLastSlot()
    else useTv.getState().tuneNumber(s.number)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const typing = e.target instanceof HTMLInputElement
    if (e.key === 'Escape' || ((e.key === 'g' || e.key === 'G') && !typing)) {
      e.preventDefault()
      close()
      return
    }
    if (e.key === '/' && !typing) {
      e.preventDefault()
      search.current?.focus()
      return
    }
    const cards = [...(grid.current?.querySelectorAll<HTMLElement>('[data-card]') ?? [])]
    const at = cards.indexOf(document.activeElement as HTMLElement)
    if (typing && e.key === 'ArrowDown') {
      e.preventDefault()
      cards[0]?.focus()
      return
    }
    if (at < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const cols = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(' ').length : 1
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key as 'ArrowLeft']
    const next = cards[at + step]
    if (next) {
      e.preventDefault()
      next.focus()
      next.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      search.current?.focus()
    }
  }

  const fresh = (s: Slot) => newest.has(s.number)
  const ch = current.kind === 'empty' ? null : current.channel

  return (
    <div className="overview fixed inset-0 z-[45] flex flex-col" role="dialog" aria-modal="true" aria-label="頻道總覽" onKeyDown={onKeyDown}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="關閉頻道總覽" tabIndex={-1} onClick={close} />

      <div className="overview-panel relative mx-auto flex h-full w-full max-w-6xl flex-col">
        <header className="flex flex-wrap items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pt-6">
          <div className="mr-auto">
            <p className="flex items-center gap-2 text-[11px] font-black tracking-[0.3em] text-[#ffd400]">
              <LayoutGrid className="size-3.5" aria-hidden /> 台北安可大舞台
            </p>
            <h2 className="mt-1 text-2xl leading-none font-black text-[#fff4d6] sm:text-3xl">頻道總覽</h2>
            <p className="mt-1.5 text-xs text-white/55">{liveCount} 台開播中・點一台直接轉過去</p>
          </div>
          <label className="overview-search order-last flex w-full items-center gap-2 sm:order-none sm:w-72">
            <Search className="size-4 shrink-0 text-white/50" aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋台號、名稱或作者"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              aria-label="搜尋頻道"
            />
          </label>
          <button
            type="button"
            className="gate-chip"
            onClick={() => setSort((s) => (s === 'number' ? 'newest' : 'number'))}
            title="切換排序"
          >
            <ArrowUpDown className="size-4" aria-hidden />
            {sort === 'number' ? '依台號' : '最新上架'}
          </button>
          <button type="button" className="overview-close" onClick={close} aria-label="關閉（Esc）" title="關閉（Esc）">
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          {!query && (
            <section className="overview-hero mb-6 grid gap-4 rounded-2xl p-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:p-4" aria-label="現正播放">
              <div className="relative overflow-hidden rounded-xl">
                <Thumb slot={current} className="aspect-[40/21] w-full" />
                <span className="overview-osd absolute top-2 left-2">{current.number}</span>
              </div>
              <div className="flex min-w-0 flex-col">
                <p className="flex items-center gap-2 text-xs font-black tracking-[0.2em] text-[#ff5a6e]">
                  <i className="live-dot" aria-hidden /> 現正播放・第 {current.number} 台
                </p>
                <h3 className="mt-2 line-clamp-2 text-xl leading-snug font-black text-[#fff4d6] sm:text-2xl">{titleOf(current)}</h3>
                {ch && <p className="mt-1 text-sm text-white/60">by {ch.author}{ch.tools ? `・${ch.tools}` : ''}</p>}
                {ch?.message ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75">{ch.message}</p>
                ) : (
                  !ch && <p className="mt-2 text-sm text-white/75">這一台還空著，等你用 AI 做一座安可政策大舞台。</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button type="button" className="ink-btn flex items-center gap-1.5 px-4 py-2 text-sm" data-on="true" onClick={close}>
                    <Play className="size-4" /> 繼續觀看
                  </button>
                  <button
                    type="button"
                    className="gate-chip"
                    onClick={() => {
                      close()
                      useTv.getState().setInfoOpen(true)
                    }}
                  >
                    <Info className="size-4" aria-hidden /> 頻道資訊
                  </button>
                  {ch && (
                    <button type="button" className="gate-chip" onClick={() => void shareChannel(current.number, 'overview')}>
                      <Share2 className="size-4" aria-hidden /> 分享
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {shown.length ? (
            <div ref={grid} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
              {shown.map((s) => {
                const on = s.number === current.number
                return (
                  <button
                    key={`${s.kind}:${s.number}`}
                    type="button"
                    data-card
                    data-current={on}
                    onClick={() => pick(s)}
                    aria-label={s.kind === 'empty' ? `第 ${s.number} 台：訊號徵求中，上架你的舞台` : `轉到第 ${s.number} 台：${titleOf(s)}，${authorOf(s)}`}
                    className={`overview-card group text-left ${on ? 'overview-card--on' : ''}`}
                  >
                    <span className="overview-thumb relative block overflow-hidden rounded-xl">
                      <Thumb slot={s} className="aspect-[40/21] w-full transition-transform duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]" />
                      <span className="overview-osd absolute top-2 left-2">{s.number}</span>
                      <Badges slot={s} current={on} fresh={fresh(s)} />
                      <span className="overview-go absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 pt-8 pb-2 text-sm font-black text-white">
                        {s.kind === 'empty' ? (
                          <>
                            <Upload className="size-4" /> 換你上台
                          </>
                        ) : on ? (
                          <>
                            <Play className="size-4" /> 回到這一台
                          </>
                        ) : (
                          <>
                            <Play className="size-4" /> 轉到這一台
                          </>
                        )}
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-[15px] leading-snug font-black text-[#fff4d6]">
                      {s.kind === 'empty' ? '訊號徵求中・換你上台' : titleOf(s)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/50">
                      {s.kind === 'empty' ? '用 AI 做一座你的安可政策大舞台' : `by ${authorOf(s)}`}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-white/60">找不到「{query}」，換個台號、名稱或作者試試。</p>
          )}
        </div>
      </div>
    </div>
  )
}
