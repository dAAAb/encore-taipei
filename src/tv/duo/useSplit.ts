import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'

const KEY = 'encore.duo.split.v2'
/** iPhone Duo inner display held upright: 1878 × 2670 px. */
const DUO_PANEL = 2670 / 1878
const MIN = 0.25
const MAX = 0.7

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function savedRatio() {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v >= MIN && v <= MAX ? v : null
  } catch {
    return null
  }
}

/**
 * Where the hinge is, in page coordinates. Safari only reports display segments behind a feature
 * flag, so without them a foldable-shaped screen gets an estimate: on such large screens the browser
 * bars sit at the top, so the hinge is half the screen height up from the bottom of the page.
 * `screen` is trusted only when it describes this display (its short side equals the page width);
 * the iPhone Duo reports its outer display there, so its inner panel's shape is used instead.
 */
export function findFold(w: number, h: number): { top: number; bottom: number; screenH: number } | null {
  try {
    const segs = (window as unknown as { viewport?: { segments?: ArrayLike<DOMRectReadOnly> | null } }).viewport?.segments
    if (segs && segs.length === 2) {
      const [a, b] = [segs[0], segs[1]]
      if (a.bottom <= b.top + 1 && Math.abs(a.left - b.left) < 2) return { top: a.bottom, bottom: Math.max(a.bottom, b.top), screenH: h }
    }
  } catch {
    /* no segments API */
  }
  const sw = Math.min(screen.width, screen.height)
  const sh = Math.max(screen.width, screen.height)
  let screenH: number
  if (sw && Math.abs(sw - w) <= 2) {
    if (sh / sw < 1.3 || sh / sw > 1.5) return null
    screenH = sh
  } else {
    screenH = w * DUO_PANEL
  }
  const hinge = h - screenH / 2
  if (!Number.isFinite(hinge) || hinge < h * 0.3 || hinge > h * 0.65) return null
  return { top: hinge - 8, bottom: hinge + 8, screenH }
}

/** ?duo: how tall the TV is above the remote, for a screen held upright. */
export function useSplit(enabled: boolean) {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [ratio, setRatio] = useState<number | null>(savedRatio)

  useEffect(() => {
    if (!enabled) return
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [enabled])

  const { w, h } = vp
  const active = enabled && w >= 280 && h > w * 1.05
  const fold = active && ratio == null ? findFold(w, h) : null
  const tv = Math.round(clamp(ratio != null ? ratio * h : fold ? fold.top : clamp((w * 9) / 16, h * 0.34, h * 0.55), h * MIN, h * MAX))
  const gutter = fold ? Math.max(12, Math.round(fold.bottom - fold.top)) : 12

  const onGutterDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      let last: number | null = null
      const move = (ev: PointerEvent) => {
        last = clamp(ev.clientY / Math.max(1, h), MIN, MAX)
        setRatio(last)
      }
      const up = () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
        try {
          if (last != null) localStorage.setItem(KEY, String(last))
        } catch {
          /* not saved; still applies for this visit */
        }
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
    },
    [h],
  )

  const reset = useCallback(() => {
    setRatio(null)
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const debug = active ? `頁面 ${w}×${h}｜screen ${screen.width}×${screen.height}｜螢幕高推估 ${fold ? Math.round(fold.screenH) : '—'}｜電視 ${tv}${ratio != null ? `（手動 ${ratio.toFixed(2)}）` : ''}` : ''
  return { active, tv, gutter, onGutterDown, reset, debug }
}
