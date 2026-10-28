import { rpc, RpcError } from '@/tv/channel-data'

export interface ChatMessage {
  id: number
  name: string
  body: string
  created_at: string
  /** Sent from this browser and not public yet (messages are reviewed before everyone sees them). */
  pending?: boolean
}

const NAME_KEY = 'encore.chatName'
const MINE_KEY = 'encore.chatMine'
const KEEP_MS = 24 * 3600 * 1000

export const chatName = () => localStorage.getItem(NAME_KEY) ?? `市民${Math.floor(100 + Math.random() * 900)}`
export const saveChatName = (n: string) => localStorage.setItem(NAME_KEY, n)

/** This browser's messages still waiting for review, so the poster keeps seeing what they said. */
function waiting(): ChatMessage[] {
  try {
    const list = JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]') as ChatMessage[]
    return list.filter((m) => Date.now() - Date.parse(m.created_at) < KEEP_MS)
  } catch {
    return []
  }
}

const saveWaiting = (list: ChatMessage[]) => localStorage.setItem(MINE_KEY, JSON.stringify(list.slice(-20)))

/** Public messages, plus this browser's own ones that are not public yet. Newest first. */
export async function recentChat(): Promise<ChatMessage[]> {
  const rows = await rpc<ChatMessage[]>('encore_chat_recent', { p_limit: 40 })
  const ids = new Set(rows.map((r) => r.id))
  const mine = waiting()
  const still = mine.filter((m) => !ids.has(m.id))
  if (still.length !== mine.length) saveWaiting(still)
  return [...rows, ...still.map((m) => ({ ...m, pending: true }))].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

const ERRORS: Record<string, string> = {
  empty: '說點什麼吧！',
  duplicate: '同一句話剛剛說過囉。',
  rate_limited: '頂樓太熱鬧了，等一分鐘再說。',
}

export async function postChat(name: string, body: string): Promise<ChatMessage> {
  let row: ChatMessage
  try {
    row = (await rpc<ChatMessage[]>('encore_chat_post', { p_name: name, p_body: body }))[0]
  } catch (e) {
    throw new Error(e instanceof RpcError ? (ERRORS[e.message] ?? '送不出去，等一下再試。') : '連不上伺服器。')
  }
  saveWaiting([...waiting(), row])
  return { ...row, pending: true }
}
