import { Tv, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { useClub } from '@/lib/store'

export const BETA_URL = `${import.meta.env.BASE_URL}beta/`
const SNOOZE_KEY = 'encore.betaInviteSnoozedUntil'
const SHOW_AFTER_MS = 20000
const SNOOZE_DAYS = 3

/** After a visitor has danced a while, offer the immersive Encore TV beta. Dismissing hides it for a few days. */
export function BetaInvite() {
  const started = useClub((s) => s.started)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!started) return
    if (Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()) return
    const t = window.setTimeout(() => {
      setOpen(true)
      track('beta_invite_view')
    }, SHOW_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [started])

  if (!open) return null

  const dismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5))
    setOpen(false)
    track('beta_invite_dismiss')
  }

  return (
    <aside
      className="ink-card slide-up fixed bottom-[252px] left-3 z-30 w-[min(380px,calc(100vw-24px))] p-4 pr-10"
      role="dialog"
      aria-label="體驗沈浸式 beta 版：台北安可電視台"
    >
      <button type="button" onClick={dismiss} className="absolute top-2 right-2 rounded-full p-1.5 text-[#4a4f6e] hover:bg-black/5" aria-label="先不要">
        <X className="size-4" />
      </button>
      <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2 py-0.5 text-[11px] font-black tracking-[0.14em] text-[#0c0812]">
        <Tv className="size-3.5" /> 沈浸式 BETA
      </p>
      <p className="mt-2 text-lg leading-snug font-black text-[#13204f]">要不要試試「台北安可電視台」？</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#2a2f52]">
        走進後室打開一台老電視：看新聞特輯、轉台看每位市民用 AI 做的台北安可舞台，還有可愛動物伴舞和關機彩蛋。建議開聲音。
      </p>
      <div className="mt-3 flex gap-2">
        <a href={BETA_URL} onClick={() => track('beta_invite_click', { place: 'invite' })} className="ink-btn flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm" data-on="true">
          <Tv className="size-4" /> 打開電視
        </a>
        <button type="button" onClick={dismiss} className="ink-btn px-3 py-2 text-sm">
          先不要
        </button>
      </div>
    </aside>
  )
}
