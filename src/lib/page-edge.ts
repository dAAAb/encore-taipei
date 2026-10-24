/**
 * Safari on iPhone (iOS 26 and later) floats its tab bar over the page and fills the strip behind
 * it with the page background, so a full-screen scene that stops at the bar shows a hard black band.
 * Painting the page background in the colour along the bottom of the scene makes the bar read as
 * part of the picture. Only colours change here, never layout, so nothing can move or break.
 */
export type Rgb = readonly [number, number, number]

const HEX = /^#[0-9a-f]{6}$/
let current = ''
let themeDefault: string | null = null

const channel = (v: number) => Math.max(0, Math.min(255, Math.round(Number.isFinite(v) ? v : 0)))

export const rgbHex = ([r, g, b]: Rgb, scale = 1) => `#${[r, g, b].map((v) => channel(v * scale).toString(16).padStart(2, '0')).join('')}`

/** Pass null to hand the background back to the stylesheet. */
export function setPageEdgeColor(color: string | null) {
  if (color !== null && !HEX.test(color)) return
  const next = color ?? ''
  if (next === current) return
  current = next
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta && themeDefault === null) themeDefault = meta.content
  document.documentElement.style.backgroundColor = next
  document.body.style.backgroundColor = next
  if (meta) meta.content = color ?? themeDefault ?? meta.content
}

/** Smooths sampled colours so the page background drifts instead of flickering frame to frame. */
export function edgeSmoother(rate = 0.35) {
  let value: [number, number, number] | null = null
  return (sample: Rgb): Rgb => {
    if (!sample.every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) return value ?? [0, 0, 0]
    if (!value) value = [sample[0], sample[1], sample[2]]
    else for (let i = 0; i < 3; i++) value[i] += (sample[i] - value[i]) * rate
    return value
  }
}
