import { Check, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import making from '@/data/making-of.json'
import { useTv } from '../store'
import { useCopy } from './useCopy'

export const STARTER_PROMPT = `幫我做一個 3D 互動網站：我的「台北安可」舞台。

- 主題：〈台北安可〉是蔣萬安 2026 連任競選主題曲，請做一座屬於我的台北安可舞台。
- 畫風：（寫下你想要的風格，例如 Colorfigures 卡通 3D、賽博龐克、像素風、水彩、黏土動畫…）
- 地點：（舞台在哪？例如 2033 年的台北 AI 園區、大稻埕碼頭、101 頂樓、捷運車廂、夜市…）
- 台上：（誰在表演？做什麼動作？）
- 台下：（觀眾在做什麼？喊什麼？）
- 內容：上 gov.taipei 查蔣萬安四年施政成績和「黃金十年」政見，做成畫面裡的文字或互動，每一條附上資料來源。
- 音樂：嵌入 YouTube 上的〈台北安可〉官方 MV（影片 ID uKCiYJdv6Zg）當背景音樂。
- 要求：手機和電腦都能玩；可以被別的網站用 iframe 嵌入；最後幫我部署成公開的 https 網址。`

const PROTOCOL = `// 選用：讓台北安可電視台的遙控器控制你的舞台
window.addEventListener('message', (e) => {
  if (e.data?.type === 'encore:volume') {
    // e.data.volume：0～1，e.data.muted：true / false
  }
  if (e.data?.type === 'encore:color') {
    // 遙控器彩色鍵：e.data.color 是 'red'、'green'、'yellow' 或 'blue'
  }
})
// 讓觀眾在你的舞台裡也能用 ← → 轉台
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key) && parent !== window) {
    parent.postMessage({ type: 'encore:key', key: e.key }, '*')
  }
})`

function CopyBlock({ id, text, label }: { id: string; text: string; label: string }) {
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
  ['回來上架', '轉到「訊號徵求中」那一台，按「上架這一台」貼上網址，馬上就能預覽。'],
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
