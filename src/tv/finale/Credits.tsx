import { useEffect, useMemo, useRef, useState } from 'react'
import making from '@/data/making-of.json'
import tvMaking from '@/data/encore-tv-making.json'
import { useTv } from '../store'

const nf = new Intl.NumberFormat('zh-TW')
const wan = (n: number) => `${nf.format(Math.round(n / 1e4))} 萬`

type Block = { title: string; rows: [string, string][] } | { big: string; sub?: string }
interface PhotoCredit {
  title: string
  author: string
  license: string
}

/** The end-of-show roll: every channel's maker, the tools, the sources, and what it cost to make. */
export function Credits({ duration, onEnd }: { duration: number; onEnd: () => void }) {
  const channels = useTv((s) => s.channels)
  const [photos, setPhotos] = useState<PhotoCredit[]>([])
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}montage/credits.json`)
      .then((r) => r.json() as Promise<{ credits: PhotoCredit[] }>)
      .then((d) => setPhotos(d.credits))
      .catch(() => {})
  }, [])
  const blocks = useMemo<Block[]>(
    () => [
      { big: '台北安可電視台', sub: 'ENCORE.TAIPEI' },
      {
        title: '頻道',
        rows: [...channels.map((c) => [`第 ${c.channel} 台`, `${c.title}｜${c.author}`] as [string, string]), [`第 ${Math.max(2026, ...channels.map((c) => c.channel)) + 1} 台`, '等你來做']],
      },
      { title: '製作', rows: [['總製作・創意', '台北安可市民'], ['AI 協作', 'Cursor Cloud Agent × Claude Opus 5.5'], ['畫風靈感', 'Colorfigures｜April Zhu'], ['場景靈感', '《電馭叛客 2077》來生酒吧・The Backrooms']] },
      { title: '音樂與聲音', rows: [['主題曲', '〈台北安可〉蔣萬安 2026 連任競選主題曲（YouTube 官方 MV）'], ['新聞旁白', 'Microsoft Edge 語音合成 zh-TW HsiaoChen'], ['電視音效', 'Web Audio 即時合成']] },
      {
        title: '資料與影像',
        rows: [
          ['施政資料', '臺北市政府 gov.taipei・中央社・公視・聯合報'],
          ['新聞特輯照片', 'Wikimedia Commons 等公共領域與創用 CC 授權影像'],
          ['地球夜景', 'NASA Earth Observatory・Black Marble'],
          ['星座臉孔', 'MediaPipe Face Landmarker'],
        ],
      },
      ...(photos.length
        ? [
            {
              title: '新聞特輯照片（Wikimedia Commons）',
              rows: photos.map((p) => [p.license, `${p.author}《${p.title.replace(/\.(jpe?g|png|svg)$/i, '')}》`] as [string, string]),
            },
          ]
        : []),
      {
        title: '開源工具',
        rows: [
          ['3D', 'three.js・React Three Fiber・drei・postprocessing'],
          ['網頁', 'React・Vite・TypeScript・Tailwind CSS・shadcn/ui・Base UI'],
          ['其他', 'zustand・lucide・Supabase・resvg・fontTools・Noto Sans TC'],
        ],
      },
      {
        title: '製作數字（估算）',
        rows: [
          ['第 2026 台', `${wan(making.tokens.total)} tokens・約 US$${making.usd}（NT$${nf.format(making.twd)}）`],
          ['電視台本身', `${wan(tvMaking.tokens.total)} tokens・約 US$${tvMaking.usd}（NT$${nf.format(tvMaking.twd)}）`],
          ['模型', `${making.model}・依官方牌價與央行匯率 ${making.fx.rate} 估算`],
        ],
      },
      { title: '特別感謝', rows: [['', '每一位做了自己舞台的市民'], ['', '還有，正在看的你']] },
      { big: '安可！', sub: '下一台，換你上台' },
    ],
    [channels, photos],
  )

  const body = useRef<HTMLDivElement>(null)
  const end = useRef(onEnd)
  const started = useRef(0)
  end.current = onEnd

  // Each line moves and fades on its own: Safari drops parts of one tall transformed layer under a mask.
  useEffect(() => {
    const root = body.current!
    const lines = [...root.querySelectorAll<HTMLElement>('[data-line]')]
    let raf = 0
    let done = false
    const tick = (now: number) => {
      if (!started.current) started.current = now
      const vh = window.innerHeight
      const total = root.scrollHeight
      const k = Math.min(1, (now - started.current) / 1000 / duration)
      const offset = vh - k * (vh + total)
      for (const el of lines) {
        const y = el.offsetTop + offset
        const h = el.offsetHeight
        if (y > vh || y + h < 0) {
          el.style.visibility = 'hidden'
          continue
        }
        const mid = (y + h / 2) / vh
        const fade = Math.min(1, Math.max(0, mid / 0.14), Math.max(0, (1 - mid) / 0.14))
        el.style.visibility = 'visible'
        el.style.opacity = fade.toFixed(3)
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
      }
      if (k >= 1 && !done) {
        done = true
        end.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration, blocks])

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div ref={body} className="relative mx-auto w-[min(92vw,640px)] pb-[40vh] text-center">
        {blocks.map((b, i) =>
          'big' in b ? (
            <div key={i} className="py-[16vh]">
              <div data-line className="invisible will-change-transform">
                <p className="tv-caption text-[44px] leading-none font-black tracking-[0.08em] text-[#fff4d6] sm:text-[64px]">{b.big}</p>
                {b.sub && <p className="tv-caption mt-3 text-sm font-black tracking-[0.5em] text-[#ffd400]">{b.sub}</p>}
              </div>
            </div>
          ) : (
            <section key={i} className="py-8">
              <h3 data-line className="tv-caption invisible mb-4 text-xs font-black tracking-[0.45em] text-[#8fb4ff] will-change-transform">
                {b.title}
              </h3>
              <dl className="space-y-2.5">
                {b.rows.map(([k, v], j) => (
                  <div key={j} data-line className="invisible grid grid-cols-[1fr_1.6fr] gap-4 text-left will-change-transform">
                    <dt className="tv-caption text-right text-sm text-white/60 sm:text-base">{k}</dt>
                    <dd className="tv-caption text-sm font-bold text-white sm:text-base">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ),
        )}
      </div>
    </div>
  )
}
