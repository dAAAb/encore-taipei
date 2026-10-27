import { useEffect, useRef, useState } from 'react'
import { listenMotion, requestMotion, type Vec } from '@/lib/motion'
import type { EncoreCommand } from './protocol'

const TILT_EVERY = 250
const GUST_EVERY = 220

/**
 * 體感安可 from the phone in your hand: its key fires a round of confetti on the TV,
 * then shaking the phone throws the confetti about and tilting it changes which way it falls.
 * Messages are throttled so a paired TV stays under the realtime channel's rate limit.
 */
export function useRemoteEncore(send: (c: EncoreCommand) => void) {
  const [armed, setArmed] = useState(false)
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  useEffect(() => {
    if (!armed) return
    let lastTilt = 0
    let lastGust = 0
    let sent: Vec = { x: 0, y: 1 }
    return listenMotion({
      onTilt: (g) => {
        const now = performance.now()
        if (now - lastTilt < TILT_EVERY || Math.hypot(g.x - sent.x, g.y - sent.y) < 0.08) return
        lastTilt = now
        sent = g
        sendRef.current({ a: 'encore', t: 'tilt', x: g.x, y: g.y })
      },
      onShake: (d, s) => {
        const now = performance.now()
        if (now - lastGust < GUST_EVERY) return
        lastGust = now
        sendRef.current({ a: 'encore', t: 'gust', x: d.x * s, y: d.y * s })
      },
      onSilent: () => setArmed(false),
    })
  }, [armed])

  const press = () => {
    sendRef.current({ a: 'encore', t: 'burst', x: 0, y: 0 })
    if (!armed) void requestMotion().then((a) => a === 'granted' && setArmed(true))
  }
  return { armed, press }
}
