import { create } from 'zustand'
import { engine } from '@/audio/synth'
import { track } from '@/lib/analytics'
import { Confetti } from '@/lib/confetti'
import { requestMotion, type Vec } from '@/lib/motion'
import { hypeRef } from '@/lib/store'
import type { EncoreCommand } from '@/tv/duo/protocol'

/** 體感安可 on the 2026 stage: who is driving the confetti, and what the visitor was told. */
export type Mode = 'off' | 'motion' | 'pointer' | 'denied'

const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))
export const fx = new Confetti(touch || (navigator.hardwareConcurrency ?? 8) <= 4)

export const HINTS: Record<Exclude<Mode, 'off'>, string> = {
  motion: '搖一搖手機放彩帶；彩帶落地前，傾斜或晃動手機就能改變飄落方向。',
  pointer: touch
    ? '這台裝置讀不到動作感測器。按「體感安可」放彩帶，手指在畫面上快速左右滑動可以吹動它們。'
    : '電腦（包括 Mac 筆電）沒有開放動作感測器給瀏覽器：快速左右甩動滑鼠或觸控板就能放彩帶，彩帶落地前移動游標可以吹動它們。',
  denied: '沒有拿到動作感測權限，先用按鈕放彩帶。想用搖的：重新整理後再按一次「體感安可」並選「允許」。',
}

export const useEncore = create<{ mode: Mode; hint: string | null }>(() => ({ mode: 'off', hint: null }))

let lastBurst = 0
let hintTimer = 0

export const clearHint = () => window.clearTimeout(hintTimer)

function cheer(power: number) {
  lastBurst = performance.now()
  fx.burst(power)
  hypeRef.value = Math.max(hypeRef.value, 0.95)
  engine.scream(0.45)
}

export function showHint(hint: string) {
  window.clearTimeout(hintTimer)
  useEncore.setState({ hint })
  hintTimer = window.setTimeout(() => useEncore.setState({ hint: null }), 7000)
}

/** A shake throws what is in the air; a firm one with little left on screen fires another round. */
export function shake(dir: Vec, strength: number) {
  fx.gust(dir, strength)
  const few = fx.alive < (fx.lite ? 90 : 160)
  const since = performance.now() - lastBurst
  if ((few && since > 600 && strength > 0.55) || since > 2200) cheer(0.55 + 0.35 * Math.min(1, strength))
}

/** Commands from a paired phone remote (Duo): that phone is the one being shaken. */
export function encoreCommand(c: EncoreCommand) {
  if (c.t === 'burst') cheer(1)
  else if (c.t === 'tilt') fx.tilt({ x: c.x, y: c.y }, 2500)
  else {
    const s = Math.hypot(c.x, c.y)
    if (s > 0.05) shake({ x: c.x / s, y: c.y / s }, s)
  }
}

export function press() {
  const { mode } = useEncore.getState()
  cheer(1)
  track('motion_encore', { mode })
  if (mode !== 'off') return
  void requestMotion().then((access) => {
    const next: Mode = access === 'granted' ? 'motion' : access === 'denied' ? 'denied' : 'pointer'
    useEncore.setState({ mode: next })
    // A phone confirms itself with its first reading; a laptop with silence.
    if (next !== 'motion') showHint(HINTS[next])
  })
}

if (import.meta.env.DEV) Object.assign(window, { __encore: { fx, useEncore } })
