import { Check, Clock, Copy, ExternalLink, Eye, EyeOff, Hammer, KeyRound, Loader2, LogOut, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { rpc, RpcError, SUPABASE_KEY, SUPABASE_URL, type AdminChannel } from '@/tv/channel-data'
import { useCopy } from '@/tv/components/useCopy'
import { channelPath, stageUrl } from '@/tv/routing'

const KEY = 'encore.adminKey'
const REBUILD_URL = 'https://github.com/dAAAb/encore-taipei/actions/workflows/deploy-pages.yml'
const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

type RebuildResult = { ok: true } | { ok: false; reason: 'not_configured' | 'token' | 'failed'; message?: string }

/** Ask GitHub Actions (through the encore-rebuild edge function) to rebuild share pages and screenshots now. */
async function requestRebuild(adminKey: string): Promise<RebuildResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/encore-rebuild`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: adminKey }),
    })
    const d = (await res.json()) as { ok?: boolean; error?: string; status?: number; message?: string }
    if (d.ok) return { ok: true }
    if (d.error === 'not_configured') return { ok: false, reason: 'not_configured' }
    if (d.status === 401 || d.status === 403 || d.status === 404) return { ok: false, reason: 'token', message: d.message }
    return { ok: false, reason: 'failed', message: d.message ?? d.error }
  } catch (e) {
    return { ok: false, reason: 'failed', message: (e as Error).message }
  }
}
type Filter = 'all' | 'pending' | 'live' | 'hidden' | 'chat'

interface ChatRow {
  id: number
  name: string
  body: string
  hidden: boolean
  created_at: string
}

const STATUS: Record<AdminChannel['status'], { label: string; cls: string }> = {
  pending: { label: '待審核', cls: 'bg-[#ffd400] text-[#10151d]' },
  live: { label: '上架中', cls: 'bg-[#75b022] text-white' },
  hidden: { label: '已隱藏', cls: 'bg-white/15 text-white/70' },
}

/** The private admin link carries the key in the URL fragment, which never reaches any server. */
function readKey() {
  const m = location.hash.match(/key=([^&]+)/)
  if (m) {
    localStorage.setItem(KEY, decodeURIComponent(m[1]))
    history.replaceState(null, '', location.pathname + location.search)
  }
  return localStorage.getItem(KEY)
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

interface ShareCard {
  image: string | null
  fresh: boolean
}

/**
 * What a shared link to this channel shows right now, read from its built share page.
 * `fresh` means the last build already knew this channel's title.
 */
function useShareCard(ch: AdminChannel, nonce: number): ShareCard | null {
  const [card, setCard] = useState<ShareCard | null>(null)
  useEffect(() => {
    if (ch.channel == null) return setCard(null)
    let alive = true
    fetch(channelPath(ch.channel), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const meta = (p: string) => doc.querySelector(`meta[property="og:${p}"]`)?.getAttribute('content') ?? ''
        const image = meta('image')
        if (alive) setCard({ image: image ? `${image}${image.includes('?') ? '&' : '?'}v=${nonce}` : null, fresh: meta('title').includes(ch.title) })
      })
      .catch(() => alive && setCard(null))
    return () => {
      alive = false
    }
  }, [ch.channel, ch.title, nonce])
  return card
}

function Capsule({ ch, nonce }: { ch: AdminChannel; nonce: number }) {
  const card = useShareCard(ch, nonce)
  const [broken, setBroken] = useState<string | null>(null)
  const src = ch.og_image ?? card?.image ?? null
  const hue = (ch.title.length * 47 + (ch.channel ?? 0) * 13) % 360
  return (
    <div className="relative">
      {src && broken !== src ? (
        <img src={src} alt={`第 ${ch.channel} 台分享預覽圖`} className="aspect-[1200/630] w-full bg-black object-cover" loading="lazy" onError={() => setBroken(src)} />
      ) : (
        <div
          className="relative flex aspect-[1200/630] w-full items-end overflow-hidden p-3"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 35%), hsl(${(hue + 60) % 360} 70% 18%))` }}
        >
          <span className="absolute top-1 right-3 text-5xl font-black text-white/15 tabular-nums">{ch.channel ?? '—'}</span>
          <span className="line-clamp-2 text-lg leading-tight font-black text-white drop-shadow">{ch.title}</span>
        </div>
      )}
      {ch.status === 'live' && card && (
        <span
          className={`absolute bottom-2 left-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-black ${card.fresh || ch.og_image ? 'bg-[#10151d]/85 text-[#b6ffb0]' : 'bg-[#ffd400] text-[#10151d]'}`}
          title={card.fresh || ch.og_image ? '分享連結已經會顯示這張圖' : '分享頁還是上次建置的版本，每小時第 17 分自動重建'}
        >
          {card.fresh || ch.og_image ? <Check className="size-3" /> : <Clock className="size-3" />}
          {card.fresh || ch.og_image ? '分享圖已更新' : '分享圖等待重建'}
        </span>
      )}
    </div>
  )
}

function RotateKey({ adminKey, onRotated }: { adminKey: string; onRotated: (k: string) => void }) {
  const [open, setOpen] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()
  const link = fresh ? `${location.origin}${import.meta.env.BASE_URL}admin/#key=${fresh}` : ''

  const rotate = async () => {
    setBusy(true)
    setError(null)
    try {
      const k = await rpc<string>('encore_admin_rotate', { p_key: adminKey })
      localStorage.setItem(KEY, k)
      setFresh(k)
      onRotated(k)
    } catch (e) {
      setError(`更換失敗：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="steam-btn steam-btn--plain flex items-center gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" /> 更換金鑰
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setFresh(null)
        }}
      >
        <DialogContent className="border border-white/10 bg-[#18212c] text-[#c7d5e0] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">{fresh ? '新的管理連結' : '更換管理金鑰'}</DialogTitle>
            <DialogDescription className="text-[#8fa3b5]">
              {fresh ? '舊連結已經失效。請把新連結存進密碼管理器或書籤，這個視窗關掉後就看不到了。' : '會產生一組新金鑰，舊的管理連結立刻失效。這台瀏覽器會自動換成新金鑰，不用重新登入。'}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-md bg-[#e0304a]/20 p-2 text-sm text-[#ff8a99]">{error}</p>}
          {fresh ? (
            <div className="space-y-3">
              <p className="rounded-md bg-black/40 p-3 font-mono text-xs break-all text-[#b6ffb0]">{link}</p>
              <button type="button" className="steam-btn steam-btn--go flex w-full items-center justify-center gap-1.5" onClick={() => copy(link, 'admin-link')}>
                {copied === 'admin-link' ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === 'admin-link' ? '已複製' : '複製新連結'}
              </button>
            </div>
          ) : (
            <button type="button" disabled={busy} className="steam-btn steam-btn--danger flex w-full items-center justify-center gap-1.5" onClick={rotate}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} 確定更換
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Tower rooftop chat moderation: every message, newest first, each one hideable. */
function RoofChatAdmin({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<ChatRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    rpc<ChatRow[]>('encore_admin_chat', { p_key: adminKey })
      .then(setRows)
      .catch(() => setError('讀不到頂樓留言。'))
  }, [adminKey])

  const toggle = async (row: ChatRow) => {
    setBusy(row.id)
    try {
      const hidden = await rpc<boolean>('encore_admin_chat_hide', { p_key: adminKey, p_id: row.id, p_hidden: !row.hidden })
      setRows((rs) => (rs ?? []).map((r) => (r.id === row.id ? { ...r, hidden } : r)))
    } catch {
      setError('更新失敗，請再試一次。')
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="rounded-md bg-[#e0304a]/20 p-3 text-sm text-[#ff8a99]">{error}</p>
  if (!rows)
    return (
      <p className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> 讀取頂樓留言中…
      </p>
    )
  if (rows.length === 0) return <p className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm">頂樓還沒有人留言。</p>
  return (
    <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-[#18212c]">
      {rows.map((r) => (
        <li key={r.id} className={`flex items-start gap-3 p-3 ${r.hidden ? 'opacity-50' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <b className="text-white">{r.name}</b> <span className="text-xs text-[#8fa3b5]">{fmt(r.created_at)}</span>
              {r.hidden && <span className="ml-2 rounded bg-white/10 px-1.5 py-px text-[11px]">已隱藏</span>}
            </p>
            <p className="break-words text-[#c7d5e0]">{r.body}</p>
          </div>
          <button type="button" disabled={busy === r.id} className="steam-btn steam-btn--plain flex shrink-0 items-center gap-1.5 text-xs" onClick={() => toggle(r)}>
            {r.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {r.hidden ? '恢復' : '隱藏'}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Login({ onKey, error }: { onKey: (k: string) => void; error: string | null }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = String(new FormData(e.currentTarget).get('key') ?? '').trim()
    const m = v.match(/key=([^&\s]+)/)
    onKey(m ? decodeURIComponent(m[1]) : v)
  }
  return (
    <div className="steam-bg flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="steam-card w-full max-w-md rounded-xl p-6">
        <p className="flex items-center gap-2 text-xs font-black tracking-[0.25em] text-[#66c0f4]">
          <KeyRound className="size-4" /> ENCORE.TAIPEI ADMIN
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">頻道管理登入</h1>
        <p className="mt-2 text-sm leading-relaxed">用專屬管理連結開啟這一頁就會自動登入。也可以把連結或金鑰貼在下面。</p>
        <input name="key" autoFocus className="steam-input mt-4 w-full font-mono text-sm" placeholder="https://…/admin/#key=… 或 enc_…" />
        {error && <p className="mt-3 rounded-md bg-[#e0304a]/20 p-2 text-sm text-[#ff8a99]">{error}</p>}
        <button type="submit" className="steam-btn steam-btn--go mt-4 w-full">
          登入
        </button>
      </form>
    </div>
  )
}

function RebuildSetup({
  open,
  onOpenChange,
  adminKey,
  configuredAt,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  adminKey: string
  configuredAt: string | null
  onSaved: (at: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const token = String(new FormData(form).get('token') ?? '').trim()
    if (!token) return
    setBusy(true)
    setNote(null)
    try {
      await rpc('encore_admin_set_setting', { p_key: adminKey, p_name: 'github_token', p_value: token })
      const test = await requestRebuild(adminKey)
      if (test.ok) {
        onSaved(new Date().toISOString())
        form.reset()
        setNote({ ok: true, text: '設定完成，已經請 GitHub 重建一次。之後上架或改台號都會自動重建。' })
      } else {
        await rpc('encore_admin_set_setting', { p_key: adminKey, p_name: 'github_token', p_value: null })
        onSaved(null)
        setNote({ ok: false, text: 'GitHub 不接受這個權杖。請確認只選了 dAAAb/encore-taipei，而且 Actions 權限是 Read and write。' })
      }
    } catch (err) {
      setNote({ ok: false, text: `儲存失敗：${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await rpc('encore_admin_set_setting', { p_key: adminKey, p_name: 'github_token', p_value: null })
      onSaved(null)
      setNote({ ok: true, text: '已清除。分享圖改回等排程或手動重建。' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border border-white/10 bg-[#18212c] text-[#c7d5e0] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white">上架後自動重建分享圖</DialogTitle>
          <DialogDescription className="text-[#8fa3b5]">
            GitHub 的排程常常延遲很久才跑。給後台一把只能「啟動建置」的 GitHub 權杖，上架或改台號後就會立刻重建，大約 3～5 分鐘分享頁和舞台截圖就會更新。
          </DialogDescription>
        </DialogHeader>
        {configuredAt && (
          <p className="flex items-center gap-2 rounded-md bg-[#75b022]/15 p-3 text-sm text-[#b6ffb0]">
            <Check className="size-4 shrink-0" /> 已設定（{fmt(configuredAt)}）。要換權杖就在下面貼新的。
          </p>
        )}
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            打開 GitHub 的
            <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="mx-1 font-bold text-[#66c0f4] underline">
              建立 Fine-grained token
            </a>
            頁面。
          </li>
          <li>名稱隨意（例如 encore-taipei-rebuild），到期日可選 1 年。</li>
          <li>
            Repository access 選 <b className="text-white">Only select repositories</b> → <b className="text-white">dAAAb/encore-taipei</b>。
          </li>
          <li>
            Permissions 只加一項：<b className="text-white">Actions → Read and write</b>，其他都不用。
          </li>
          <li>按 Generate token，複製貼到下面。權杖只存在伺服器端，網頁讀不到。</li>
        </ol>
        <form onSubmit={save} className="space-y-2">
          <input name="token" type="password" autoComplete="off" placeholder="github_pat_…" className="steam-input w-full font-mono text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="steam-btn steam-btn--go flex flex-1 items-center justify-center gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} 儲存並測試
            </button>
            {configuredAt && (
              <button type="button" disabled={busy} className="steam-btn steam-btn--danger" onClick={clear}>
                清除
              </button>
            )}
          </div>
        </form>
        {note && <p className={`rounded-md p-2 text-sm ${note.ok ? 'bg-[#75b022]/15 text-[#b6ffb0]' : 'bg-[#e0304a]/20 text-[#ff8a99]'}`}>{note.text}</p>}
        <p className="text-xs text-[#8fa3b5]">
          不想設定也可以：到
          <a href={REBUILD_URL} target="_blank" rel="noreferrer" className="mx-1 underline">
            GitHub Actions
          </a>
          按 Run workflow 手動重建。
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function AdminApp() {
  const [key, setKey] = useState<string | null>(readKey)
  const [rows, setRows] = useState<AdminChannel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nonce, setNonce] = useState(() => Date.now())
  const [tokenAt, setTokenAt] = useState<string | null | undefined>(undefined)
  const [setupOpen, setSetupOpen] = useState(false)
  const [rebuildNote, setRebuildNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const load = useCallback(async (k: string) => {
    setLoading(true)
    setNonce(Date.now())
    setError(null)
    try {
      setRows(await rpc<AdminChannel[]>('encore_admin_list', { p_key: k }))
    } catch (e) {
      if (e instanceof RpcError && e.message === 'forbidden') {
        localStorage.removeItem(KEY)
        setKey(null)
        setError('金鑰不正確，請確認管理連結。')
      } else setError('讀取失敗，請檢查網路後重新整理。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (key) load(key)
  }, [key, load])

  useEffect(() => {
    if (!key) return
    rpc<{ name: string; updated_at: string }[]>('encore_admin_settings', { p_key: key })
      .then((rows) => setTokenAt(rows.find((r) => r.name === 'github_token')?.updated_at ?? null))
      .catch(() => setTokenAt(null))
  }, [key])

  useEffect(() => {
    if (!rebuildNote) return
    const t = window.setTimeout(() => setRebuildNote(null), 12000)
    return () => window.clearTimeout(t)
  }, [rebuildNote])

  const rebuild = async (auto: boolean) => {
    if (!key) return
    if (!tokenAt) {
      if (!auto) setSetupOpen(true)
      return
    }
    setRebuilding(true)
    const res = await requestRebuild(key)
    setRebuilding(false)
    if (res.ok) setRebuildNote({ ok: true, text: '已請 GitHub 重建，約 3～5 分鐘後分享頁和舞台截圖會更新，按「重新整理」就看得到。' })
    else if (res.reason === 'not_configured') {
      setTokenAt(null)
      if (!auto) setSetupOpen(true)
    } else if (res.reason === 'token') setRebuildNote({ ok: false, text: 'GitHub 權杖失效或權限不足，請到「自動重建設定」換一把。' })
    else setRebuildNote({ ok: false, text: `重建請求失敗：${res.message ?? '未知錯誤'}` })
  }

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, live: 0, hidden: 0, chat: '' as number | '' }
    for (const r of rows ?? []) {
      c.all++
      c[r.status]++
    }
    return c
  }, [rows])

  const shown = filter === 'chat' ? [] : (rows ?? []).filter((r) => filter === 'all' || r.status === filter)
  const current = rows?.find((r) => r.id === openId) ?? null

  const update = async (id: string, patch: { p_status?: AdminChannel['status']; p_channel?: number | null }) => {
    if (!key) return
    setBusy(true)
    try {
      const row = await rpc<AdminChannel>('encore_admin_update', { p_key: key, p_id: id, ...patch })
      setRows((rs) => (rs ?? []).map((r) => (r.id === id ? row : r)))
      rebuild(true)
    } catch (e) {
      setError(e instanceof RpcError && /duplicate|unique/i.test(e.message) ? '這個台號已經有人用了。' : `更新失敗：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!key || !window.confirm('確定要刪除這個投稿？刪除後無法復原。')) return
    setBusy(true)
    try {
      await rpc('encore_admin_delete', { p_key: key, p_id: id })
      setRows((rs) => (rs ?? []).filter((r) => r.id !== id))
      setOpenId(null)
    } finally {
      setBusy(false)
    }
  }

  if (!key) return <Login onKey={(k) => setKey(k)} error={error} />

  return (
    <div className="steam-bg min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#10151d]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="mr-auto">
            <p className="text-[11px] font-black tracking-[0.3em] text-[#66c0f4]">ENCORE.TAIPEI</p>
            <h1 className="text-xl font-black text-white">頻道管理</h1>
          </div>
          <a href={import.meta.env.BASE_URL} className="steam-btn steam-btn--plain flex items-center gap-1.5">
            <ExternalLink className="size-4" /> 打開電視
          </a>
          <button
            type="button"
            className="steam-btn steam-btn--plain flex items-center gap-1.5"
            onClick={() => rebuild(false)}
            disabled={rebuilding}
            title={tokenAt ? '請 GitHub 立刻重建分享頁和舞台截圖' : '先設定自動重建'}
          >
            {rebuilding ? <Loader2 className="size-4 animate-spin" /> : <Hammer className="size-4" />} 立即重建分享圖
          </button>
          <button type="button" className="steam-btn steam-btn--plain flex items-center gap-1.5" onClick={() => setSetupOpen(true)}>
            <Settings2 className="size-4" /> 自動重建設定
            {tokenAt === null && <span className="size-2 rounded-full bg-[#ffd400]" aria-label="尚未設定" />}
          </button>
          <RotateKey adminKey={key} onRotated={setKey} />
          <button type="button" className="steam-btn steam-btn--plain flex items-center gap-1.5" onClick={() => load(key)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
          </button>
          <button
            type="button"
            className="steam-btn steam-btn--plain flex items-center gap-1.5"
            onClick={() => {
              localStorage.removeItem(KEY)
              setKey(null)
              setRows(null)
            }}
          >
            <LogOut className="size-4" /> 登出
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {(
            [
              ['all', '全部'],
              ['pending', '待審核'],
              ['live', '上架中'],
              ['hidden', '已隱藏'],
              ['chat', '頂樓聊天'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold whitespace-nowrap ${filter === f ? 'bg-[#66c0f4] text-[#10151d]' : 'text-[#c7d5e0] hover:bg-white/10'}`}
            >
              {label} <span className="opacity-70">{counts[f]}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && <p className="mb-4 rounded-md bg-[#e0304a]/20 p-3 text-sm text-[#ff8a99]">{error}</p>}
        {rebuildNote && (
          <p className={`mb-4 rounded-md p-3 text-sm ${rebuildNote.ok ? 'bg-[#75b022]/15 text-[#b6ffb0]' : 'bg-[#e0304a]/20 text-[#ff8a99]'}`} role="status">
            {rebuildNote.text}
          </p>
        )}
        {tokenAt === null && (
          <p className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-[#ffd400]/30 bg-[#ffd400]/10 p-3 text-sm text-[#ffe9a8]">
            新上架的頻道要等 GitHub 排程（常延遲）才會有分享圖。
            <button type="button" className="font-black underline" onClick={() => setSetupOpen(true)}>
              設定上架後自動重建
            </button>
          </p>
        )}
        {!rows && loading && (
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> 讀取投稿中…
          </p>
        )}
        {filter === 'chat' && <RoofChatAdmin adminKey={key} />}
        {rows && filter !== 'chat' && shown.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm">這裡還沒有東西。</p>}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((ch) => (
            <button key={ch.id} type="button" className="steam-card group overflow-hidden rounded-lg text-left" onClick={() => setOpenId(ch.id)}>
              <div className="relative">
                <Capsule ch={ch} nonce={nonce} />
                <span className={`absolute top-2 left-2 rounded px-2 py-0.5 text-[11px] font-black ${STATUS[ch.status].cls}`}>{STATUS[ch.status].label}</span>
                {ch.channel != null && (
                  <span className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 font-mono text-xs font-bold text-[#b6ffb0]">CH {ch.channel}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
                  預覽與管理
                </span>
              </div>
              <div className="p-3">
                <p className="truncate font-black text-white">{ch.title}</p>
                <p className="truncate text-xs">
                  {ch.author} · {fmt(ch.created_at ?? ch.updated_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>

      <RebuildSetup open={setupOpen} onOpenChange={setSetupOpen} adminKey={key} configuredAt={tokenAt ?? null} onSaved={setTokenAt} />

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        {current && (
          <DialogContent className="max-h-[92dvh] overflow-y-auto border border-white/10 bg-[#18212c] p-0 text-[#c7d5e0] sm:max-w-5xl">
            <div className="grid lg:grid-cols-[1.6fr_1fr]">
              <div className="relative aspect-video w-full bg-black lg:aspect-auto lg:min-h-[480px]">
                <iframe
                  key={current.id}
                  src={stageUrl(current.url)}
                  title={`預覽：${current.title}`}
                  className="absolute inset-0 h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
                  allow="autoplay; fullscreen"
                />
              </div>
              <div className="space-y-4 p-5">
                <DialogHeader>
                  <p className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-black ${STATUS[current.status].cls}`}>{STATUS[current.status].label}</span>
                    {current.channel != null && <span className="font-mono text-xs font-bold text-[#b6ffb0]">CH {current.channel}</span>}
                  </p>
                  <DialogTitle className="text-2xl font-black text-white">{current.title}</DialogTitle>
                  <DialogDescription className="text-[#8fa3b5]">
                    by {current.author}
                    {current.tools ? ` · ${current.tools}` : ''} · {fmt(current.created_at ?? current.updated_at)}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-2">
                  {current.status !== 'live' ? (
                    <button type="button" disabled={busy} className="steam-btn steam-btn--go col-span-2 flex items-center justify-center gap-1.5" onClick={() => update(current.id, { p_status: 'live' })}>
                      <Eye className="size-4" /> 上架（{current.channel ?? '自動排下一台'}）
                    </button>
                  ) : (
                    <button type="button" disabled={busy} className="steam-btn steam-btn--plain col-span-2 flex items-center justify-center gap-1.5" onClick={() => update(current.id, { p_status: 'hidden' })}>
                      <EyeOff className="size-4" /> 隱藏（下架）
                    </button>
                  )}
                  <a href={stageUrl(current.url)} target="_blank" rel="noreferrer" className="steam-btn steam-btn--plain flex items-center justify-center gap-1.5">
                    <ExternalLink className="size-4" /> 新分頁
                  </a>
                  <button type="button" disabled={busy} className="steam-btn steam-btn--danger flex items-center justify-center gap-1.5" onClick={() => remove(current.id)}>
                    <Trash2 className="size-4" /> 刪除
                  </button>
                </div>

                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const n = Number(new FormData(e.currentTarget).get('channel'))
                    if (Number.isInteger(n) && n >= 2026) update(current.id, { p_channel: n })
                  }}
                >
                  <label className="flex-1 text-xs font-bold">
                    台號
                    <input name="channel" type="number" min={2026} defaultValue={current.channel ?? ''} key={current.channel ?? 'none'} className="steam-input mt-1 w-full font-mono" />
                  </label>
                  <button type="submit" disabled={busy} className="steam-btn steam-btn--plain">
                    改台號
                  </button>
                </form>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-bold text-[#66c0f4]">網址</dt>
                    <dd className="break-all">{current.url}</dd>
                  </div>
                  {current.author_url && (
                    <div>
                      <dt className="text-xs font-bold text-[#66c0f4]">作者／原始碼</dt>
                      <dd className="break-all">
                        <a href={current.author_url} target="_blank" rel="noreferrer" className="underline">
                          {current.author_url}
                        </a>
                      </dd>
                    </div>
                  )}
                  {current.contact && (
                    <div>
                      <dt className="text-xs font-bold text-[#66c0f4]">聯絡 Email（不公開）</dt>
                      <dd>
                        <a href={`mailto:${current.contact}`} className="underline">
                          {current.contact}
                        </a>
                      </dd>
                    </div>
                  )}
                  {current.message && (
                    <div>
                      <dt className="text-xs font-bold text-[#66c0f4]">想說的話</dt>
                      <dd className="whitespace-pre-wrap">{current.message}</dd>
                    </div>
                  )}
                  {current.prompt && (
                    <div>
                      <dt className="text-xs font-bold text-[#66c0f4]">Prompt</dt>
                      <dd>
                        <pre className="max-h-48 overflow-auto rounded-md bg-black/30 p-2 text-xs whitespace-pre-wrap">{current.prompt}</pre>
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="text-xs leading-relaxed text-[#8fa3b5]">
                  上架或改台號後，電視會立刻顯示；設定好「自動重建」的話，分享頁和舞台截圖約 3～5 分鐘後更新。
                </p>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
