/** Shared by the browser app and the build (scripts/channel-pages.ts): keep this file free of DOM APIs. */

export const SUPABASE_URL = 'https://ogvqrfdgflxhfdqwtrxq.supabase.co'
/** Publishable key: safe to ship, every table is locked behind RLS and the encore_* functions. */
export const SUPABASE_KEY = 'sb_publishable_Fe_h6sRUasUjh3jCuXkgKA_qtCRfwpM'

export const FIRST_CHANNEL = 2026

export interface Channel {
  id: string
  channel: number
  title: string
  url: string
  author: string
  author_url: string | null
  message: string | null
  prompt: string | null
  tools: string | null
  og_image: string | null
  created_at?: string
}

export interface AdminChannel extends Channel {
  channel: number
  status: 'pending' | 'live' | 'hidden'
  contact: string | null
  updated_at: string
  reviewed_at: string | null
}

export const FALLBACK_CHANNELS: Channel[] = [
  {
    id: 'builtin-2026',
    channel: 2026,
    title: '台北安可之夜',
    url: 'club/',
    author: 'dAAAb',
    author_url: 'https://github.com/dAAAb/encore-taipei',
    message: '2033 年的台北 AI 園區夜店，蔣萬安在台上旋轉跳舞，群眾喊出四年政績。第一台，也是一切的開始。',
    prompt: null,
    tools: 'Cursor · Claude Opus 5.5 · three.js',
    og_image: null,
  },
  {
    id: 'builtin-2027',
    channel: 2027,
    title: '2033 台北來生夜店 AFTERLIFE',
    url: 'https://daaab.github.io/taipei-punk-2033/',
    author: 'dAAAb',
    author_url: 'https://github.com/dAAAb/taipei-punk-2033',
    message: 'Colorfigures 3D 風格的另一座 2033 台北來生夜店，同一首台北安可，不同的舞台。',
    prompt: null,
    tools: null,
    og_image: null,
  },
]

export class RpcError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function rpc<T>(fn: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      message = ((await res.json()) as { message?: string }).message ?? message
    } catch {
      /* non-JSON error body */
    }
    throw new RpcError(message, res.status)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function fetchLiveChannels(timeoutMs = 8000): Promise<Channel[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const rows = await rpc<Channel[]>('encore_public_channels', {}, ctrl.signal)
    return rows.filter((r) => Number.isInteger(r.channel)).sort((a, b) => a.channel - b.channel)
  } finally {
    clearTimeout(timer)
  }
}
