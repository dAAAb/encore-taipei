import { ExternalLink, FileCheck2, FileUp, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSiteMeta, htmlUploadsEnabled, RpcError, rpc, UPLOAD_MAX_BYTES, UploadError, uploadHtmlStage, type SiteMeta } from '../channel-data'
import { useTv, type PendingStage } from '../store'

const ERRORS: Record<string, string> = {
  invalid_url: '作品網址要是 https:// 開頭的公開網址。',
  missing_fields: '舞台名稱和你的名字都要填喔。',
  invalid_author_url: '作者連結要是 http(s):// 開頭的網址。',
  duplicate_url: '這個網址已經有人送過了，正在排隊審核中。',
  rate_limited: '現在送件的人太多了，請過幾分鐘再試一次。',
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
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

type Upload = { state: 'busy' | 'done'; name: string; bytes: number; url?: string }

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
const looksLikeHtml = (s: string) => /^\s*</.test(s) && /<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]/i.test(s)

/** `unit` is how a slot is counted where the form opens: TV channels (台) or tower floors (樓). */
export function SubmitForm({ unit = '台' }: { unit?: '台' | '樓' }) {
  const open = useTv((s) => s.submitOpen)
  const setOpen = useTv((s) => s.setSubmitOpen)
  const setPending = useTv((s) => s.setPending)
  const nextNumber = useTv((s) => s.dial[s.dial.length - 1]?.number)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ink-card max-h-[90dvh] overflow-y-auto border-0 p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-[#13204f]">上架第 {nextNumber} {unit}</DialogTitle>
          <DialogDescription className="text-[#4a4f6e]">
            送出後這一{unit}馬上換成你的舞台（只有你看得到）。管理員審核通過才會正式上架，號碼可能會變動。
          </DialogDescription>
        </DialogHeader>
        <SubmitFields
          number={nextNumber}
          unit={unit}
          onDone={(pending) => {
            setPending(pending)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

/** The submission form itself, shared by the TV/tower dialog and the standalone /submit/ page. */
export function SubmitFields({ number, unit = '台', onDone }: { number?: number; unit?: '台' | '樓'; onDone: (pending: PendingStage) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [site, setSite] = useState<SiteMeta | null>(null)
  const [reading, setReading] = useState(false)
  const auto = useRef({ title: '', message: '' })
  const [uploadsOn, setUploadsOn] = useState(false)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const drags = useRef(0)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    void htmlUploadsEnabled().then((on) => alive && setUploadsOn(on))
    return () => {
      alive = false
    }
  }, [])

  // Fill the name (and the note, if the site has a description) from the stage itself; never overwrite what the user typed.
  const prefill = (meta: { title: string | null; description: string | null }) => {
    if (meta.title) {
      const next = meta.title.slice(0, 80)
      setTitle((cur) => (cur === '' || cur === auto.current.title ? ((auto.current.title = next), next) : cur))
    }
    if (meta.description) {
      const next = meta.description.slice(0, 1000)
      setMessage((cur) => (cur === '' || cur === auto.current.message ? ((auto.current.message = next), next) : cur))
    }
  }

  const sendFile = async (file: File) => {
    setUploadError(null)
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') return setUploadError('請上傳 .html 檔（單一網頁檔）。')
    if (file.size > UPLOAD_MAX_BYTES) return setUploadError('檔案太大了，單一 HTML 最多 5 MB。')
    setUpload({ state: 'busy', name: file.name, bytes: file.size })
    try {
      const res = await uploadHtmlStage(file)
      setUpload({ state: 'done', name: file.name, bytes: file.size, url: res.url })
      setUrl(res.url)
      prefill(res)
    } catch (err) {
      setUpload(null)
      setUploadError(err instanceof UploadError ? err.message : '上傳失敗，請稍後再試。')
    }
  }

  const dropProps = uploadsOn
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          drags.current++
          setDragging(true)
        },
        onDragOver: (e: DragEvent) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        },
        onDragLeave: (e: DragEvent) => {
          if (!hasFiles(e)) return
          drags.current = Math.max(0, drags.current - 1)
          if (!drags.current) setDragging(false)
        },
        onDrop: (e: DragEvent) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          drags.current = 0
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file && upload?.state !== 'busy') void sendFile(file)
        },
      }
    : {}

  const uploaded = upload?.state === 'done' && upload.url === url ? upload : null

  useEffect(() => {
    setSite(null)
    if (!/^https:\/\/[^/\s]+\.[^/\s]+/.test(url)) return
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setReading(true)
      try {
        const meta = await fetchSiteMeta(url, ctrl.signal)
        if (!meta) return
        setSite(meta)
        prefill(meta)
      } catch {
        // Unreachable or slow sites just leave the fields for the user.
      } finally {
        if (!ctrl.signal.aborted) setReading(false)
      }
    }, 500)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
      setReading(false)
    }
  }, [url])

  const titleHint = reading ? (
    <span className="inline-flex items-center gap-1">
      <Loader2 className="size-3 animate-spin" /> 正在讀取網站名稱…
    </span>
  ) : title && title === auto.current.title ? (
    <span className="inline-flex items-center gap-1 text-[#1a7f3c]">
      <Sparkles className="size-3" /> 已從你的網站抓到，可以修改
    </span>
  ) : undefined

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const url = get('url')
    setBusy(true)
    setError(null)
    try {
      const og = site?.image ?? null
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
      onDone({
        id: res.id,
        channel: number ?? 0,
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
      setUrl('')
      setTitle('')
      setMessage('')
      setUpload(null)
      auto.current = { title: '', message: '' }
    } catch (err) {
      const msg = err instanceof RpcError ? (ERRORS[err.message] ?? `送出失敗：${err.message}`) : '連不上伺服器，請檢查網路後再試一次。'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="relative mt-1 space-y-3.5" onSubmit={submit} {...dropProps}>
      <div className="relative">
        <Field label="作品網址 *" hint={uploadsOn ? '公開的 https 網址，或上傳單一 HTML 檔' : '公開的 https 網址'}>
          <div className="flex gap-2">
            <input
              name="url"
              type="url"
              required
              pattern="https://.+"
              placeholder={uploadsOn ? 'https://… 或把 .html 檔拖進來' : 'https://你的帳號.github.io/my-encore/'}
              className={`${input} min-w-0`}
              value={url}
              onChange={(e) => setUrl(e.target.value.trim())}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (!uploadsOn || !looksLikeHtml(text)) return
                e.preventDefault()
                void sendFile(new File([text], 'pasted.html', { type: 'text/html' }))
              }}
            />
            {uploadsOn && (
              <button
                type="button"
                className="ink-btn flex shrink-0 items-center gap-1 px-3 text-sm disabled:opacity-60"
                disabled={upload?.state === 'busy'}
                onClick={() => picker.current?.click()}
                title="上傳單一 HTML 檔（例如 Gemini Canvas、Claude 做的網頁），也可以直接拖進來或在網址欄貼上程式碼"
              >
                {upload?.state === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                <span className="hidden sm:inline">上傳 HTML</span>
                <span className="sm:hidden">HTML</span>
              </button>
            )}
          </div>
        </Field>
        {uploadsOn && (
          <input
            ref={picker}
            type="file"
            accept=".html,.htm,text/html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void sendFile(file)
            }}
          />
        )}
        {dragging && (
          <div className="pointer-events-none absolute -inset-1.5 z-10 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#1f4fd1] bg-[#e8eeff]/95 text-sm font-black text-[#1f4fd1]">
            <FileUp className="size-5" /> 放開就上傳這個 HTML 檔
          </div>
        )}
        {upload?.state === 'busy' && (
          <p className="mt-2 flex items-center gap-2 rounded-xl border-2 border-[#0c0812] bg-[#e8eeff] px-3 py-2 text-sm font-bold text-[#1f4fd1]" role="status">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              正在上傳 {upload.name}（{size(upload.bytes)}）…
            </span>
          </p>
        )}
        {uploaded && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-[#0c0812] bg-[#e7f7ea] px-3 py-2 text-sm text-[#13204f]" role="status">
            <FileCheck2 className="mt-0.5 size-4 shrink-0 text-[#1a7f3c]" />
            <div className="min-w-0 flex-1">
              <p className="font-black [overflow-wrap:anywhere]">
                已上傳 {uploaded.name}（{size(uploaded.bytes)}）
              </p>
              <p className="text-xs leading-snug text-[#4a4f6e]">檔案公開存放在 IPFS。送出後電視會先播給你看，審核通過才會正式上架。</p>
            </div>
            <a href={uploaded.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs font-black text-[#1f4fd1] underline">
              預覽 <ExternalLink className="size-3" />
            </a>
          </div>
        )}
        {uploadError && <p className="mt-2 rounded-xl border-2 border-[#0c0812] bg-[#ffd9d9] p-2.5 text-sm font-bold text-[#7a1020]">{uploadError}</p>}
      </div>
      <Field label="舞台名稱 *" hint={titleHint}>
        <input name="title" required maxLength={80} placeholder="貼上網址後會自動帶入，例如：大稻埕煙火安可夜" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="你的名字或暱稱 *">
        <input name="author" required maxLength={60} placeholder="會顯示在頻道資訊和片尾名單" className={input} />
      </Field>
      <Field label="想說的話／製作說明" hint="選填">
        <textarea
          name="message"
          maxLength={1000}
          rows={3}
          placeholder="這座舞台的故事、想對大家說的話"
          className={input}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
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
        <span>
          我同意作品名稱、網址、名字、說明與 prompt 公開展示在台北安可大舞台。作品內容友善正向、不攻擊或抹黑任何人與政黨，
          使用的照片、音樂與字型都有授權；不符合的作品不會上架。
        </span>
      </label>

      {error && <p className="rounded-xl border-2 border-[#0c0812] bg-[#ffd9d9] p-2.5 text-sm font-bold text-[#7a1020]">{error}</p>}

      <button type="submit" disabled={busy} className="ink-btn flex w-full items-center justify-center gap-2 px-5 py-2.5 text-base disabled:opacity-60" data-on="true">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? '送出中…' : number ? `送出，佔下第 ${number} ${unit}` : '送出'}
      </button>
    </form>
  )
}
