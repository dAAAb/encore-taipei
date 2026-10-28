import { ArrowRight, Building2, Check, ShieldCheck, Tv } from 'lucide-react'
import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { FIRST_CHANNEL, fetchLiveChannels, htmlUploadsEnabled, type Channel } from '@/tv/channel-data'
import { CopyBlock } from '@/tv/components/Guide'
import { OnboardAgent } from '@/tv/components/OnboardAgent'
import { SubmitFields } from '@/tv/components/SubmitForm'
import { STARTER_PROMPT } from '@/tv/prompts'
import { channelPath } from '@/tv/routing'
import { loadPending, savePending, type PendingStage } from '@/tv/store'

const BASE = import.meta.env.BASE_URL
const TV_URL = BASE
const TOWER_URL = `${BASE.replace(/beta\/$/, '')}tower/`
const REDIRECT_MS = 2600

const STEPS = [
  ['用 AI 做舞台', '按下面的按鈕複製完整 prompt，貼給 Cursor、Claude、Gemini 或 ChatGPT。不會寫程式也沒關係，用說的就好。'],
  ['部署成公開網址', '請 AI 幫你放到 GitHub Pages、Vercel、Cloudflare Pages 或 Netlify（都有免費方案）。網址要是 https，而且允許被 iframe 嵌入。'],
  ['回來這裡上架', '貼上網址送出，馬上帶你到大舞台預覽。管理員審核通過後，所有人都看得到。'],
] as const

const UPLOAD_STEPS = [
  STEPS[0],
  ['取得網址或 HTML 檔', '已經部署好就準備 https 網址。Gemini Canvas、Claude 這類只有一個 HTML 檔的作品，把程式碼存成 .html 檔就好，不用自己部署。'],
  ['回來這裡上架', '貼上網址，或把 .html 檔拖進上架表單（也可以直接貼上程式碼），送出後馬上帶你到大舞台預覽。管理員審核通過後，所有人都看得到。'],
] as const

const RULES = [
  '內容友善正向，不攻擊、不抹黑任何人或政黨。',
  '照片、音樂、字型只用自己做的、公有領域或有授權的素材，並標示來源。',
  '頁面上註明「粉絲創作，非官方網站」。',
  '不符合規範的作品不會上架；上架後若有疑慮，管理員可以隨時下架。',
] as const

async function loadChannels(): Promise<Channel[]> {
  try {
    return await fetchLiveChannels()
  } catch {
    const r = await fetch(`${BASE}channels.json`)
    return (await r.json()) as Channel[]
  }
}

export function SubmitApp() {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [earlier, setEarlier] = useState<PendingStage | null>(() => loadPending())
  const [sent, setSent] = useState<PendingStage | null>(null)
  const [uploadsOn, setUploadsOn] = useState(false)

  useEffect(() => {
    void htmlUploadsEnabled().then(setUploadsOn)
    loadChannels()
      .then(setChannels)
      .catch(() => setChannels([]))
  }, [])

  const next = channels ? Math.max(FIRST_CHANNEL - 1, ...channels.map((c) => c.channel)) + 1 : undefined
  const waiting = earlier && channels && !channels.some((c) => c.url === earlier.url) ? earlier : null

  useEffect(() => {
    if (!sent) return
    const t = window.setTimeout(() => location.assign(channelPath(sent.channel)), REDIRECT_MS)
    return () => window.clearTimeout(t)
  }, [sent])

  const done = (pending: PendingStage) => {
    savePending(pending)
    setEarlier(pending)
    setSent(pending)
    track('stage_submit', { place: 'submit_page', channel_number: pending.channel })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="submit-bg min-h-dvh text-[#fff4d6]">
      <div className="color-bars h-1.5 w-full" />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
        <a
          href={TV_URL}
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-3 py-1 text-xs font-black tracking-[0.18em] text-[#0c0812] shadow-[3px_3px_0_#0c0812]"
        >
          <span className="size-2 rounded-full bg-[#ff2a4d] shadow-[0_0_8px_#ff2a4d]" />
          ENCORE.TAIPEI
        </a>
        <nav className="flex gap-2">
          <a href={TV_URL} className="ink-btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Tv className="size-4" /> 大舞台
          </a>
          <a href={TOWER_URL} className="ink-btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Building2 className="size-4" /> 大樓
          </a>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <section className="lg:pt-4">
          <p className="inline-flex items-center gap-2 rounded-md border-2 border-[#b6ffb0]/60 bg-black/50 px-2.5 py-1 font-mono text-sm font-black text-[#b6ffb0]">
            CH {next ?? '····'} · NO SIGNAL
          </p>
          <h1 className="submit-title mt-5 text-[56px] leading-none font-black tracking-[0.04em] sm:text-[76px]">換你上台</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed font-bold text-[#ffe9a8]">
            用 AI 做一座你自己的台北安可舞台，貼上網址就能上架。送出後馬上在大舞台第 {next ?? '…'} 台預覽，審核通過後正式開播，也會變成台北安可大樓的
            {next ? ` ${next} ` : ' '}樓。
          </p>
          <p className="mt-3 text-sm text-white/55">
            目前已有 {channels ? channels.length : '…'} 台開播。先去
            <a href={TV_URL} className="mx-1 underline underline-offset-2 hover:text-white">
              大舞台
            </a>
            或
            <a href={TOWER_URL} className="mx-1 underline underline-offset-2 hover:text-white">
              大樓
            </a>
            看看大家做了什麼。
          </p>
        </section>

        <section className="lg:row-span-2">
          <div className="ink-card p-5 sm:p-6 lg:sticky lg:top-6">
            {sent ? (
              <div className="py-6 text-center" role="status">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-[#0c0812] bg-[#b6ffb0] shadow-[3px_3px_0_#2b2f9e]">
                  <Check className="size-7 text-[#0c0812]" strokeWidth={3} />
                </span>
                <h2 className="mt-4 text-2xl font-black">送出成功！</h2>
                <p className="mt-2 leading-relaxed text-[#2a2f52]">
                  「{sent.title}」已經送進審核。現在帶你到大舞台第 <b>{sent.channel}</b> 台預覽（只有你看得到）。
                </p>
                <a href={channelPath(sent.channel)} className="ink-btn mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-base" data-on="true">
                  馬上去看 <ArrowRight className="size-4" />
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-[#13204f]">上架第 {next ?? '…'} 台</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4a4f6e]">
                  送出後馬上帶你到大舞台預覽。管理員審核通過才會正式上架，號碼可能會變動。
                </p>
                {waiting && (
                  <p className="mt-3 rounded-xl border-2 border-[#0c0812] bg-[#fff6d6] p-2.5 text-sm text-[#2a2f52]">
                    你送出的「{waiting.title}」還在審核中，可以到
                    <a href={channelPath(next ?? waiting.channel)} className="mx-1 font-black text-[#1f4fd1] underline underline-offset-2">
                      大舞台
                    </a>
                    預覽。再送一件的話，預覽會換成新的作品。
                  </p>
                )}
                <SubmitFields number={next} onDone={done} />
              </>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="ink-card p-5 sm:p-6">
            <h2 className="text-xl font-black">三步驟上台</h2>
            <ol className="mt-3 space-y-3">
              {(uploadsOn ? UPLOAD_STEPS : STEPS).map(([title, body], i) => (
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
            <div className="mt-4 rounded-2xl border-2 border-[#0c0812] bg-[#fff6d6] p-3 shadow-[3px_3px_0_#0c0812]">
              <OnboardAgent />
              <p className="mt-2 text-center text-xs leading-relaxed text-[#4a4f6e]">
                一次複製全部：入門 prompt、遙控器程式碼（選用）、第 2026 台原始 prompt 和上架步驟。
              </p>
            </div>
            <details className="mt-3 rounded-xl border-2 border-[#0c0812]/20 bg-white/40 p-3">
              <summary className="cursor-pointer text-sm font-black text-[#13204f]">只要入門 prompt（括號裡換成你的點子）</summary>
              <CopyBlock id="starter" text={STARTER_PROMPT} label="入門 prompt" />
            </details>
          </div>

          <div className="ink-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <ShieldCheck className="size-5 text-[#1a7f3c]" /> 上架規範
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#2a2f52]">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#1a7f3c]" strokeWidth={3} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-white/45 sm:px-6">
        粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站 ·{' '}
        <a href="https://github.com/dAAAb/encore-taipei" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
          原始碼
        </a>
      </footer>
    </div>
  )
}
