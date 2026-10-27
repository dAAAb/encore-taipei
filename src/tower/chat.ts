import { rpc, RpcError } from '@/tv/channel-data'

export interface ChatMessage {
  id: number
  name: string
  body: string
  created_at: string
}

const NAME_KEY = 'encore.chatName'

export const chatName = () => localStorage.getItem(NAME_KEY) ?? `市民${Math.floor(100 + Math.random() * 900)}`
export const saveChatName = (n: string) => localStorage.setItem(NAME_KEY, n)

export const recentChat = () => rpc<ChatMessage[]>('encore_chat_recent', { p_limit: 40 })

const ERRORS: Record<string, string> = {
  empty: '說點什麼吧！',
  duplicate: '同一句話剛剛說過囉。',
  rate_limited: '頂樓太熱鬧了，等一分鐘再說。',
}

export async function postChat(name: string, body: string): Promise<ChatMessage> {
  try {
    const rows = await rpc<ChatMessage[]>('encore_chat_post', { p_name: name, p_body: body })
    return rows[0]
  } catch (e) {
    throw new Error(e instanceof RpcError ? (ERRORS[e.message] ?? '送不出去，等一下再試。') : '連不上伺服器。')
  }
}
