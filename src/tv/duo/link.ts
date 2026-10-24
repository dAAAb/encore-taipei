import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js'
import { useEffect } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from '../channel-data'

export type LinkStatus = 'connecting' | 'online' | 'offline'
export type LinkEvent = 'cmd' | 'state' | 'hello'

const EVENTS: LinkEvent[] = ['cmd', 'state', 'hello']
const MAX_PAYLOAD = 8000

export interface DuoLink {
  send: (event: LinkEvent, payload: Record<string, unknown>) => void
  close: () => void
}

/**
 * A Supabase Realtime broadcast room shared by one TV and its remotes. Nothing is stored; messages
 * only reach whoever is in the room right now. Rejoins on its own after drops and when the page
 * comes back from the background (phones suspend sockets while locked).
 */
export function openLink(room: string, onEvent: (event: LinkEvent, payload: unknown) => void, onStatus: (s: LinkStatus) => void): DuoLink {
  let closed = false
  let client: RealtimeClient | null = null
  let channel: RealtimeChannel | null = null
  let status: LinkStatus | null = null
  let attempt = 0
  let timer = 0

  const setStatus = (s: LinkStatus) => {
    if (s === status) return
    status = s
    onStatus(s)
  }

  const rejoinLater = () => {
    window.clearTimeout(timer)
    const wait = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4))
    attempt++
    timer = window.setTimeout(() => status !== 'online' && join(), wait)
  }

  const join = async () => {
    if (closed) return
    setStatus('connecting')
    try {
      if (!client) {
        const { RealtimeClient } = await import('@supabase/realtime-js')
        if (closed) return
        client = new RealtimeClient(`${SUPABASE_URL}/realtime/v1`, { params: { apikey: SUPABASE_KEY } })
      }
      const old = channel
      const ch = client.channel(`encore-duo:${room}`, { config: { broadcast: { self: false, ack: false } } })
      for (const event of EVENTS) {
        ch.on('broadcast', { event }, (msg: { payload?: unknown }) => {
          if (closed || channel !== ch) return
          try {
            if (JSON.stringify(msg.payload ?? null).length > MAX_PAYLOAD) return
            onEvent(event, msg.payload)
          } catch {
            /* a bad message never takes the page down */
          }
        })
      }
      channel = ch
      if (old) client.removeChannel(old).catch(() => {})
      ch.subscribe((s) => {
        if (closed || channel !== ch) return
        if (s === 'SUBSCRIBED') {
          attempt = 0
          setStatus('online')
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('offline')
          rejoinLater()
        }
      })
    } catch {
      setStatus('offline')
      rejoinLater()
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && status !== 'online') {
      attempt = 0
      join()
    }
  }
  const onOnline = () => onVisible()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  join()

  return {
    send(event, payload) {
      if (closed || !channel || status !== 'online') return
      try {
        if (JSON.stringify(payload).length > MAX_PAYLOAD) return
        channel.send({ type: 'broadcast', event, payload }).catch(() => {})
      } catch {
        /* ignore */
      }
    },
    close() {
      closed = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      if (client) {
        client.removeAllChannels().catch(() => {})
        client.disconnect()
      }
    },
  }
}

/** A token bucket: true while under `perSecond` on average, allowing short bursts. */
export function rateLimiter(perSecond: number, burst = perSecond) {
  let tokens = burst
  let last = performance.now()
  return () => {
    const now = performance.now()
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * perSecond)
    last = now
    if (tokens < 1) return false
    tokens -= 1
    return true
  }
}

export function peerId() {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
}

/** Keeps the screen on while a Duo page is up; re-acquired after the tab comes back or on the next tap. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    let asking = false
    const acquire = async () => {
      if (!alive || lock || asking || document.visibilityState !== 'visible') return
      asking = true
      try {
        const l = await navigator.wakeLock.request('screen')
        if (!alive) {
          l.release().catch(() => {})
          return
        }
        lock = l
        l.addEventListener('release', () => {
          if (lock === l) lock = null
        })
      } catch {
        /* denied until the next user gesture */
      } finally {
        asking = false
      }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    window.addEventListener('pointerdown', acquire)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', acquire)
      window.removeEventListener('pointerdown', acquire)
      lock?.release().catch(() => {})
    }
  }, [active])
}
