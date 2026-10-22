import { Loader2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RpcError, rpc } from '../channel-data'
import { useTv } from '../store'

const ERRORS: Record<string, string> = {
  invalid_url: '作品網址要是 https:// 開頭的公開網址。',
  missing_fields: '舞台名稱和你的名字都要填喔。',
  invalid_author_url: '作者連結要是 http(s):// 開頭的網址。',
  duplicate_url: '這個網址已經有人送過了，正在排隊審核中。',
  rate_limited: '現在送件的人太多了，請過幾分鐘再試一次。',
}

/** Best effort: a stage's own og:image makes a better share card than the generated one. */
async function findOgImage(url: string) {
  try {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), 4000)
    const html = await fetch(url, { signal: ctrl.signal }).then((r) => r.text())
    window.clearTimeout(t)
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    return m ? new URL(m[1], url).toString() : null
  } catch {
    return null
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#13204f]">{label}</span>
      {hint && <span className="ml-1.5 text-xs text-[#6a6f8e]">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

const input =
  'w-full rounded-xl border-2 border-[#0c0812] bg-white px-3 py-2 text-[15px] text-[#13204f] shadow-[2px_2px_0_#2b2f9e] outline-none placeholder:text-[#9aa0bb] focus:border-[#1f4fd1]'

export function SubmitForm() {
  const open = useTv((s) => s.submitOpen)
  const setOpen = useTv((s) => s.setSubmitOpen)
  const setPending = useTv((s) => s.setPending)
  const nextNumber = useTv((s) => s.dial[s.dial.length - 1]?.number)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const url = get('url')
    setBusy(true)
    setError(null)
    try {
      const og = await findOgImage(url)
      const res = await rpc<{ id: string }>('encore_submit', {
        p_title: get('title'),
        p_url: url,
        p_author: get('author'),
        p_author_url: get('author_url') || null,
        p_message: get('message') || null,
        p_prompt: get('prompt') || null,
        p_tools: get('tools') || null,
        p_contact: get('contact') || null,
        p_og_image: og,
      })
      setPending({
        id: res.id,
        channel: nextNumber,
        title: get('title'),
        url,
        author: get('author'),
        author_url: get('author_url') || null,
        message: get('message') || null,
        prompt: get('prompt') || null,
        tools: get('tools') || null,
        og_image: og,
        submittedAt: new Date().toISOString(),
      })
      setOpen(false)
    } catch (err) {
      const msg = err instanceof RpcError ? (ERRORS[err.message] ?? `送出失敗：${err.message}`) : '連不上伺服器，請檢查網路後再試一次。'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ink-card max-h-[90dvh] overflow-y-auto border-0 p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-[#13204f]">上架第 {nextNumber} 台</DialogTitle>
          <DialogDescription className="text-[#4a4f6e]">
            送出後這一台馬上換成你的舞台（只有你看得到）。管理員審核通過才會正式上架，台號可能會變動。
          </DialogDescription>
        </DialogHeader>

        <form className="mt-1 space-y-3.5" onSubmit={submit}>
          <Field label="作品網址 *" hint="公開的 https 網址">
            <input name="url" type="url" required pattern="https://.+" placeholder="https://你的帳號.github.io/my-encore/" className={input} />
          </Field>
          <Field label="舞台名稱 *">
            <input name="title" required maxLength={80} placeholder="例如：大稻埕煙火安可夜" className={input} />
          </Field>
          <Field label="你的名字或暱稱 *">
            <input name="author" required maxLength={60} placeholder="會顯示在頻道資訊和片尾名單" className={input} />
          </Field>
          <Field label="想說的話／製作說明" hint="選填">
            <textarea name="message" maxLength={1000} rows={3} placeholder="這座舞台的故事、想對大家說的話" className={input} />
          </Field>
          <Field label="你用的 prompt" hint="選填，會公開讓大家改做">
            <textarea name="prompt" maxLength={12000} rows={3} placeholder="把你給 AI 的 prompt 貼在這裡" className={input} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="用了哪些工具" hint="選填">
              <input name="tools" maxLength={300} placeholder="Cursor、Claude…" className={input} />
            </Field>
            <Field label="作者／原始碼連結" hint="選填">
              <input name="author_url" type="url" maxLength={300} placeholder="https://github.com/…" className={input} />
            </Field>
          </div>
          <Field label="Email" hint="選填，不公開，審核結果通知用">
            <input name="contact" type="email" maxLength={200} placeholder="you@example.com" className={input} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-[#2a2f52]">
            <input name="agree" type="checkbox" required className="mt-1 size-4 accent-[#1f4fd1]" />
            我同意作品名稱、網址、名字、說明與 prompt 公開展示在台北安可電視台。
          </label>

          {error && <p className="rounded-xl border-2 border-[#0c0812] bg-[#ffd9d9] p-2.5 text-sm font-bold text-[#7a1020]">{error}</p>}

          <button type="submit" disabled={busy} className="ink-btn flex w-full items-center justify-center gap-2 px-5 py-2.5 text-base disabled:opacity-60" data-on="true">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? '送出中…' : `送出，佔下第 ${nextNumber} 台`}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
