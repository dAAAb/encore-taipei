import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { useTv } from '../store'
import { openLink, peerId, rateLimiter, type LinkStatus } from './link'
import { isPeerId, parseCommand, type Command } from './protocol'
import { snapshot } from './tvControl'

const REMOTE_TIMEOUT = 12000

/**
 * The TV end of ?duo=tv: listens for commands from paired remotes in its room and tells them what
 * is on screen. Commands are parsed and rate-limited before they touch anything.
 */
export function useDuoTv(room: string | null, entry: string, onCommand: (c: Command) => void) {
  const [status, setStatus] = useState<LinkStatus>('connecting')
  const [remotes, setRemotes] = useState(0)
  const [joins, setJoins] = useState(0)
  const commandRef = useRef(onCommand)
  const entryRef = useRef(entry)
  const pushRef = useRef<() => void>(() => {})

  useEffect(() => {
    commandRef.current = onCommand
    entryRef.current = entry
  })

  useEffect(() => {
    if (!room) return
    const me = peerId()
    const seen = new Map<string, number>()
    const allow = rateLimiter(12, 24)
    let timer = 0

    const recount = () => {
      const now = Date.now()
      for (const [id, at] of seen) if (now - at > REMOTE_TIMEOUT) seen.delete(id)
      setRemotes(seen.size)
    }
    const touch = (id: string) => {
      const fresh = !seen.has(id)
      seen.set(id, Date.now())
      if (fresh) {
        recount()
        setJoins((j) => j + 1)
        track('duo_remote_joined')
      }
    }

    const link = openLink(
      room,
      (event, payload) => {
        const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
        if (!p || !isPeerId(p.from) || p.from === me) return
        if (event === 'hello') {
          touch(p.from)
          schedule()
        } else if (event === 'cmd') {
          if (!allow()) return
          const cmd = parseCommand(p.c)
          if (!cmd) return
          touch(p.from)
          try {
            commandRef.current(cmd)
          } catch {
            /* one bad command must not stop the TV */
          }
        }
      },
      (s) => {
        setStatus(s)
        if (s === 'online') schedule()
      },
    )
    const push = () => link.send('state', { from: me, s: snapshot(entryRef.current) })
    function schedule() {
      window.clearTimeout(timer)
      timer = window.setTimeout(push, 120)
    }
    pushRef.current = schedule

    const unsub = useTv.subscribe((s, prev) => {
      if (s.index !== prev.index || s.dial !== prev.dial || s.volume !== prev.volume || s.muted !== prev.muted || s.phase !== prev.phase || s.stage !== prev.stage) schedule()
    })
    const beat = window.setInterval(() => {
      recount()
      push()
    }, 4000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(beat)
      unsub()
      link.close()
      pushRef.current = () => {}
    }
  }, [room])

  useEffect(() => pushRef.current(), [entry])

  return { status, remotes, joins }
}
