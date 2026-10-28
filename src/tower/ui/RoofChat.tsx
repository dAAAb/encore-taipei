import { Info, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { track } from '@/lib/analytics'
import { chatName, postChat, saveChatName, type ChatMessage } from '../chat'

const WAITING_NOTE = '已送出！留言較多時，要稍等一下才會公開。'

const when = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return '剛剛'
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(new Date(iso))
}

/** The rooftop chat: everyone up here can say hi; the latest lines also float over the deck chairs. */
export function RoofChat({ messages, loading, onPosted }: { messages: ChatMessage[]; loading: boolean; onPosted: (m: ChatMessage) => void }) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [name, setName] = useState(chatName)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<number | null>(null)
  const [cooling, setCooling] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  const ordered = [...messages].reverse()

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, open])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy || cooling) return
    setBusy(true)
    setError(null)
    try {
      saveChatName(name.trim() || '市民')
      const m = await postChat(name, text)
      onPosted(m)
      setText('')
      track('roof_chat_post')
      setCooling(true)
      window.setTimeout(() => setCooling(false), 5000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ink-btn slide-up fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-20 flex items-center gap-1.5 px-4 py-2 text-sm"
        data-on="true"
      >
        <MessageCircle className="size-4" /> 頂樓聊天室 <span className="rounded-full bg-[#0c0812] px-1.5 text-[11px] text-[#ffd400]">{messages.length}</span>
      </button>
    )

  return (
    <aside
      className="ink-card slide-up fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-30 flex max-h-[min(62dvh,560px)] w-[min(360px,calc(100vw-24px))] flex-col p-0 md:top-28 md:bottom-4 md:max-h-none"
      aria-label="頂樓聊天室"
    >
      <header className="flex items-center gap-2 border-b-2 border-[#0c0812] bg-[#ffd400] px-4 py-2.5">
        <MessageCircle className="size-4" />
        <div className="flex-1">
          <p className="text-sm leading-tight font-black">頂樓花園聊天室</p>
          <p className="text-[11px] font-bold text-[#4a3a10]">吹吹風、聊聊天，台北安可！</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-black/10" aria-label="收起聊天室">
          <X className="size-4" />
        </button>
      </header>
      <ol ref={list} className="min-h-24 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && messages.length === 0 && (
          <li className="flex items-center gap-2 text-sm text-[#6a6f8e]">
            <Loader2 className="size-4 animate-spin" /> 讀取中…
          </li>
        )}
        {!loading && messages.length === 0 && <li className="text-sm text-[#6a6f8e]">還沒有人說話，第一句交給你！</li>}
        {ordered.map((m) => (
          <li key={m.id} className="text-sm leading-snug">
            <span className="font-black text-[#c8234a]">{m.name}</span>
            <span className="ml-1.5 text-[11px] text-[#8a8fa8]">{when(m.created_at)}</span>
            {m.pending && (
              <button
                type="button"
                className="ml-1 inline-flex translate-y-[2px] rounded-full text-[#b4b8cc] hover:text-[#6a6f8e]"
                title={WAITING_NOTE}
                aria-label={WAITING_NOTE}
                aria-expanded={noteFor === m.id}
                onClick={() => setNoteFor((id) => (id === m.id ? null : m.id))}
              >
                <Info className="size-3.5" />
              </button>
            )}
            <p className="break-words text-[#13204f]">{m.body}</p>
            {m.pending && noteFor === m.id && <p className="text-[11px] text-[#8a8fa8]">{WAITING_NOTE}</p>}
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="space-y-2 border-t-2 border-dashed border-[#0c0812]/25 p-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            aria-label="暱稱"
            className="w-24 rounded-lg border-2 border-[#0c0812] bg-white px-2 py-1.5 text-sm font-bold text-[#13204f]"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder="說點什麼…"
            aria-label="訊息"
            className="min-w-0 flex-1 rounded-lg border-2 border-[#0c0812] bg-white px-2 py-1.5 text-sm text-[#13204f]"
          />
          <button type="submit" disabled={busy || cooling || !text.trim()} className="ink-btn px-3 disabled:opacity-50" data-on="true" aria-label="送出">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {error && <p className="text-xs font-bold text-[#c8234a]">{error}</p>}
        <p className="text-[10px] text-[#8a8fa8]">請友善發言，留言會公開在頂樓。</p>
      </form>
    </aside>
  )
}
