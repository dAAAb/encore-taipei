import * as THREE from 'three'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

let fontPromise: Promise<Font> | null = null

export function loadFont(): Promise<Font> {
  if (!fontPromise) {
    fontPromise = new FontLoader().loadAsync('/fonts/noto-tc-black.typeface.json')
  }
  return fontPromise
}

export interface Glyph {
  geo: THREE.BufferGeometry | null
  advance: number
}

const glyphs = new Map<string, Glyph>()

/** One extruded geometry per character at size 1, shared by every bubble, sign and ring. */
export function glyph(font: Font, ch: string): Glyph {
  let g = glyphs.get(ch)
  if (g) return g
  const data = font.data as unknown as { glyphs: Record<string, { ha: number }>; resolution: number }
  const info = data.glyphs[ch]
  const advance = info ? info.ha / data.resolution : 0.5
  let geo: THREE.BufferGeometry | null = null
  if (info && ch.trim()) {
    geo = new TextGeometry(ch, {
      font,
      size: 1,
      depth: 0.26,
      curveSegments: 3,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.022,
      bevelSegments: 1,
    })
    geo.computeVertexNormals()
  }
  g = { geo, advance }
  glyphs.set(ch, g)
  return g
}

export interface LaidChar {
  ch: string
  glyph: Glyph
  x: number
  y: number
  line: number
}

/** Lay out lines centred on (0,0); returns per-char positions at the given size. */
export function layout(font: Font, lines: string[], size: number, lineHeight = 1.32) {
  const out: LaidChar[] = []
  let maxW = 0
  const widths = lines.map((l) => [...l].reduce((w, ch) => w + glyph(font, ch).advance * size, 0))
  widths.forEach((w) => (maxW = Math.max(maxW, w)))
  const totalH = lines.length * size * lineHeight
  lines.forEach((line, li) => {
    let x = -widths[li] / 2
    const y = totalH / 2 - (li + 1) * size * lineHeight + size * 0.3
    for (const ch of line) {
      const gl = glyph(font, ch)
      out.push({ ch, glyph: gl, x, y, line: li })
      x += gl.advance * size
    }
  })
  return { chars: out, width: maxW, height: totalH }
}

/** Break a slogan into at most two balanced lines, preferring the full-width comma. */
export function wrapSlogan(text: string, maxPerLine = 10): string[] {
  const chars = [...text]
  if (chars.length <= maxPerLine) return [text]
  const comma = chars.findIndex((c, i) => (c === '，' || c === '、') && i > 2 && i < chars.length - 3)
  if (comma > 0 && comma + 1 <= maxPerLine + 1 && chars.length - comma - 1 <= maxPerLine + 1) {
    return [chars.slice(0, comma + 1).join(''), chars.slice(comma + 1).join('')]
  }
  const half = Math.ceil(chars.length / 2)
  return [chars.slice(0, half).join(''), chars.slice(half).join('')]
}
