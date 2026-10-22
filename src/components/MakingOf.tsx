import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PixelIcon } from '@/components/PixelIcon'
import data from '@/data/making-of.json'

const nf = new Intl.NumberFormat('zh-TW')

function duration(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} 小時 ${m} 分` : `${m} 分鐘`
}

function wan(n: number) {
  return n >= 1e4 ? `${nf.format(Math.round(n / 1e4))} 萬` : nf.format(n)
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border-2 border-[#0c0812] bg-white/70 p-2.5 shadow-[3px_3px_0_#2b2f9e]">
      <p className="text-[11px] font-black tracking-wider text-[#c8234a]">{label}</p>
      <p className="mt-0.5 text-lg leading-tight font-black text-[#13204f]">{value}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-[#4a4f6e]">{note}</p>}
    </div>
  )
}

const CREDITS = [
  { name: 'Cursor', role: 'AI 程式開發工具（Cloud Agent）', url: 'https://cursor.com' },
  { name: 'Claude Opus 5.5', role: 'Anthropic 的 AI 模型，負責寫程式與查資料', url: 'https://www.anthropic.com/claude' },
  { name: 'Colorfigures', role: 'April Zhu 的 3D 插畫，渲染風格參考', url: 'https://april-zhu.com/colorfigures' },
  { name: 'three.js · React Three Fiber', role: '網頁 3D 引擎', url: 'https://threejs.org' },
]

/** Footer easter egg in the data sheet: credits plus how much AI it took to build this. */
export function MakingOf() {
  const [copied, setCopied] = useState(false)
  const t = data.tokens
  const cachedShare = t.total ? Math.round((t.cacheRead / t.total) * 100) : 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group mx-auto flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md px-2 py-1 text-[11px] font-bold text-[#4a4f6e] transition-colors hover:bg-[#ffd400]/40 hover:text-[#13204f] focus-visible:outline-2 focus-visible:outline-[#1f6bff]"
            title="製作花絮"
          />
        }
      >
        <span>Made with</span>
        <span className="inline-flex items-center gap-1">
          <PixelIcon name="cursor" size={11} /> Cursor
        </span>
        <span className="text-[#c8234a]">×</span>
        <span className="inline-flex items-center gap-1">
          <PixelIcon name="claude" size={11} /> Opus 5.5
        </span>
        <span className="text-[#c8234a]">×</span>
        <span className="inline-flex items-center gap-1">
          <PixelIcon name="figure" size={11} /> Colorfigures
        </span>
      </DialogTrigger>
      <DialogContent className="ink-card flex max-h-[88dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 text-[#13204f] ring-0 sm:max-w-xl">
        <DialogHeader className="border-b-2 border-[#0c0812] px-5 pt-5 pb-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <PixelIcon name="claude" size={18} /> 製作花絮
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#4a4f6e]">
            這整個網站是用一段中文 prompt，請 AI 在 {data.agent} 裡從零寫出來的。以下是原始 prompt 和花了多少。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="第一版完成" value={duration(data.firstVersionMinutes)} note={`含後續 ${data.followUps.length} 輪修改共 ${duration(data.totalMinutes)}`} />
            <Stat label="TOKEN 用量（估）" value={`約 ${wan(t.total)}`} note={`${cachedShare}% 是重讀之前的對話，實際寫出約 ${wan(t.output)}`} />
            <Stat label="換算美金（估）" value={`約 US$${data.usd.toFixed(0)}`} note={`約 ${nf.format(data.modelCalls)} 次模型呼叫 · ${data.subagents} 個查資料小幫手`} />
            <Stat label="換算台幣（估）" value={`約 NT$${nf.format(data.twd)}`} note={`匯率 ${data.fx.rate}（${data.fx.date}）`} />
          </div>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black">原始 prompt</h3>
              <button type="button" onClick={copy} className="ink-btn flex items-center gap-1 px-2 py-0.5 text-xs" data-on={copied}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? '已複製' : '複製'}
              </button>
            </div>
            <blockquote className="mt-2 rounded-xl border-2 border-dashed border-[#0c0812] bg-[#fff8ea] p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[#2a2f52]">
              {data.prompt}
            </blockquote>
            <p className="mt-1.5 text-[11px] text-[#6a6f8e]">＋ {data.attachments}</p>
            <p className="mt-2 text-xs text-[#4a4f6e]">之後又來回修改了 {data.followUps.length} 輪：{data.followUps.join('；')}。</p>
          </section>

          <section className="rounded-xl border-2 border-[#0c0812] bg-[#ffd400] p-3 shadow-[3px_3px_0_#0c0812]">
            <h3 className="text-sm font-black">歡迎改做！</h3>
            <p className="mt-1 text-[13px] leading-relaxed">
              複製上面的 prompt，貼進 Cursor 的 Agent，把人物、城市、歌曲換成你喜歡的，就能做出你自己的版本。做好了記得分享！
            </p>
          </section>

          <section>
            <h3 className="text-sm font-black">致謝</h3>
            <ul className="mt-1.5 space-y-1 text-[13px]">
              {CREDITS.map((c) => (
                <li key={c.name}>
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-[#1f4fd1] underline-offset-2 hover:underline">
                    {c.name} <ExternalLink className="size-3" />
                  </a>
                  <span className="text-[#4a4f6e]"> — {c.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="border-t-2 border-dashed border-[#0c0812]/30 pt-3 text-[11px] leading-relaxed text-[#6a6f8e]">
            Token 與費用是依對話紀錄估算：{data.pricing}；台幣以{data.fx.source}（{data.fx.date}）{data.fx.rate} 換算。實際費用依 Cursor 方案計價而定。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
