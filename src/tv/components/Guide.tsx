import { Check, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import making from '@/data/making-of.json'
import { PROTOCOL, STARTER_PROMPT } from '../prompts'
import { useTv } from '../store'
import { OnboardAgent } from './OnboardAgent'
import { useCopy } from './useCopy'

export function CopyBlock({ id, text, label }: { id: string; text: string; label: string }) {
  const { copied, copy } = useCopy()
  return (
    <div className="relative mt-2">
      <pre className="max-h-56 overflow-auto rounded-xl border-2 border-dashed border-[#0c0812]/40 bg-white/70 p-3 pr-20 text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#13204f]">
        {text}
      </pre>
      <button
        type="button"
        className="ink-btn absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 text-xs"
        onClick={() => copy(text, id)}
        aria-label={`複製${label}`}
      >
        {copied === id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied === id ? '已複製' : '複製'}
      </button>
    </div>
  )
}

const STEPS = [
  ['打開一個 AI 寫程式工具', 'Cursor、Claude Code、OpenAI Codex、GitHub Copilot、Lovable、v0 都可以。不會寫程式也沒關係，用說的就好。'],
  ['貼上 prompt，邊看邊改', '把下面的 prompt 改成你想要的樣子貼給 AI，做出來後再跟它說哪裡要調整。'],
  ['部署成公開網址', '請 AI 幫你放到 GitHub Pages、Vercel、Cloudflare Pages 或 Netlify（都有免費方案）。網址要是 https，而且允許被 iframe 嵌入。'],
  ['回來上架', '轉到「訊號徵求中」那一台按「上架這一台」，或打開 encore.taipei/submit，貼上網址就能馬上預覽。'],
] as const

export function Guide() {
  const open = useTv((s) => s.guideOpen)
  const setOpen = useTv((s) => s.setGuideOpen)
  const setSubmitOpen = useTv((s) => s.setSubmitOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ink-card max-h-[88dvh] overflow-y-auto border-0 p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-[#13204f]">做一座你的台北安可舞台</DialogTitle>
          <DialogDescription className="text-[#4a4f6e]">安可的意義，是大家一起喊。四個步驟，用 AI 做一台自己的頻道。</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border-2 border-[#0c0812] bg-[#fff6d6] p-3 shadow-[3px_3px_0_#0c0812]">
          <OnboardAgent />
          <p className="mt-2 text-center text-xs leading-relaxed text-[#4a4f6e]">
            一次複製全部：入門 prompt、遙控器程式碼（選用）、第 2026 台原始 prompt 和上架步驟，直接貼給 Cursor、Claude、Gemini、ChatGPT 等 AI 助手。
          </p>
        </div>

        <ol className="mt-1 space-y-2.5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-[#0c0812] bg-[#ffd400] text-sm font-black text-[#0c0812]">
                {i + 1}
              </span>
              <div>
                <p className="font-black text-[#13204f]">{title}</p>
                <p className="text-sm leading-relaxed text-[#2a2f52]">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-4">
          <p className="text-sm font-black text-[#c8234a]">入門 prompt（括號裡換成你的點子）</p>
          <CopyBlock id="starter" text={STARTER_PROMPT} label="入門 prompt" />
        </section>

        <details className="mt-3 rounded-xl border-2 border-[#0c0812]/20 bg-white/40 p-3">
          <summary className="cursor-pointer text-sm font-black text-[#13204f]">第 2026 台的原始 prompt</summary>
          <CopyBlock id="original" text={making.prompt} label="第 2026 台原始 prompt" />
          <p className="mt-1.5 text-xs text-[#6a6f8e]">{making.attachments}。</p>
        </details>

        <details className="mt-3 rounded-xl border-2 border-[#0c0812]/20 bg-white/40 p-3">
          <summary className="cursor-pointer text-sm font-black text-[#13204f]">進階：讓遙控器控制你的舞台（選用）</summary>
          <p className="mt-2 text-xs leading-relaxed text-[#2a2f52]">電視會把音量和遙控器的紅綠黃藍彩色鍵傳給你的網頁；你的網頁也可以把 ← → 傳回來，讓觀眾在你的舞台裡也能轉台。</p>
          <CopyBlock id="protocol" text={PROTOCOL} label="遙控器程式碼" />
        </details>

        <button
          type="button"
          className="ink-btn mt-5 w-full px-5 py-2.5 text-base"
          data-on="true"
          onClick={() => {
            setOpen(false)
            setSubmitOpen(true)
          }}
        >
          我做好了，上架這一台
        </button>
      </DialogContent>
    </Dialog>
  )
}
