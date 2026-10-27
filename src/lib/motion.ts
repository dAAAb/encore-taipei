/**
 * Phone and tablet motion for 體感安可, in screen axes (x right, y down) whatever way the device is held.
 * Laptops (every Mac included) expose no motion sensor to the browser; they report as silent.
 */
export interface Vec {
  x: number
  y: number
}

export type MotionAccess = 'granted' | 'denied' | 'unsupported'

type RequestPermission = () => Promise<'granted' | 'denied'>

const G = 9.81
const SHAKE = 11
const SHAKE_GAP = 140
const SILENT_AFTER = 1600

export const motionApi = typeof window !== 'undefined' && 'DeviceMotionEvent' in window

/** iOS asks once per visit, and only from inside a tap; call this synchronously in the click handler. */
export function requestMotion(): Promise<MotionAccess> {
  if (!motionApi) return Promise.resolve('unsupported')
  const ask = (DeviceMotionEvent as unknown as { requestPermission?: RequestPermission }).requestPermission
  if (typeof ask !== 'function') return Promise.resolve('granted')
  return ask.call(DeviceMotionEvent).then(
    (r) => (r === 'granted' ? 'granted' : 'denied'),
    () => 'denied' as const,
  )
}

function screenAngle() {
  const a = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0
  return ((a % 360) + 360) % 360
}

/** Device axes (x right, y toward the top edge) to screen axes (x right, y down). */
function toScreen(dx: number, dy: number): Vec {
  switch (screenAngle()) {
    case 90:
      return { x: -dy, y: -dx }
    case 180:
      return { x: -dx, y: dy }
    case 270:
      return { x: dy, y: dx }
    default:
      return { x: dx, y: -dy }
  }
}

export interface MotionHandlers {
  /** Where gravity points across the screen, in g (0 when the phone lies flat, 1 held upright). */
  onTilt?: (g: Vec) => void
  /** A jolt: the way things inside the phone would be thrown, and how hard (1 ≈ a firm shake). */
  onShake?: (dir: Vec, strength: number) => void
  /** No readings arrived: a laptop or desktop. */
  onSilent?: () => void
}

export function listenMotion(h: MotionHandlers): () => void {
  if (!motionApi) {
    h.onSilent?.()
    return () => {}
  }
  // iOS reports the pull of gravity, the spec (and Android) the push against it; people hold phones top-up, which settles it.
  let sign = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? -1 : 1
  let calibrated = false
  let samples = 0
  let sumY = 0
  let sumMag = 0
  let low: Vec | null = null
  let lastShake = 0
  let heard = false

  const onMotion = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity
    if (g?.x == null || g.y == null) return
    heard = true
    const pull = toScreen(-g.x * sign, -g.y * sign)
    if (!calibrated) {
      samples++
      sumY += pull.y
      sumMag += Math.hypot(pull.x, pull.y)
      if (samples >= 20) {
        calibrated = true
        if (sumMag / samples > 5 && sumY / samples < -5) {
          sign = -sign
          low = null
          return
        }
      }
    }
    low = low ? { x: low.x + (pull.x - low.x) * 0.18, y: low.y + (pull.y - low.y) * 0.18 } : pull
    h.onTilt?.({ x: low.x / G, y: low.y / G })

    const a = e.acceleration
    const jolt = a?.x != null && a.y != null ? toScreen(a.x * sign, a.y * sign) : { x: low.x - pull.x, y: low.y - pull.y }
    const mag = Math.hypot(jolt.x, jolt.y)
    const now = performance.now()
    if (mag > SHAKE && now - lastShake > SHAKE_GAP) {
      lastShake = now
      h.onShake?.({ x: -jolt.x / mag, y: -jolt.y / mag }, Math.min(2, mag / (SHAKE * 1.6)))
    }
  }

  window.addEventListener('devicemotion', onMotion)
  const silent = window.setTimeout(() => !heard && h.onSilent?.(), SILENT_AFTER)
  return () => {
    window.clearTimeout(silent)
    window.removeEventListener('devicemotion', onMotion)
  }
}

/**
 * Laptop stand-in for a shake: the pointer whipped left-right (or up-down) a few times in quick succession.
 * Also reports how fast the pointer moves so the air can follow it.
 */
export function listenPointerShake(h: { onShake: (dir: Vec, strength: number) => void; onSweep?: (v: Vec) => void }): () => void {
  let last: { x: number; y: number; t: number } | null = null
  let dirX = 0
  let dirY = 0
  let runX = 0
  let runY = 0
  let flips: number[] = []
  let lastShake = 0

  const onMove = (e: PointerEvent) => {
    const now = performance.now()
    if (!last || now - last.t > 120) {
      last = { x: e.clientX, y: e.clientY, t: now }
      return
    }
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    const dt = Math.max(1, now - last.t) / 1000
    last = { x: e.clientX, y: e.clientY, t: now }
    h.onSweep?.({ x: dx / dt, y: dy / dt })

    const flip = (d: number, dir: number, run: number): [number, number, boolean] => {
      if (d === 0) return [dir, run, false]
      const s = Math.sign(d)
      if (s === dir) return [dir, run + Math.abs(d), false]
      return [s, Math.abs(d), dir !== 0 && run > 28]
    }
    let fx: boolean
    let fy: boolean
    ;[dirX, runX, fx] = flip(dx, dirX, runX)
    ;[dirY, runY, fy] = flip(dy, dirY, runY)
    if (fx || fy) {
      flips = flips.filter((t) => now - t < 700)
      flips.push(now)
      if (flips.length >= 3 && now - lastShake > 900) {
        lastShake = now
        flips = []
        const n = Math.hypot(dx, dy) || 1
        h.onShake({ x: dx / n, y: dy / n }, 1)
      }
    }
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  return () => window.removeEventListener('pointermove', onMove)
}
