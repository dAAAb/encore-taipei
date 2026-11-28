import * as THREE from 'three'

/**
 * The two campaign streamers, printed as repeating cloth: the first 台北安可 ribbon (sky blue, white type,
 * 「台北安可 非你不可」) and the white 安心 ribbon from the 11/14 parade (black 台北安可 and TAIPEI ENCORE between
 * blue, yellow and red hearts).
 */
export type RibbonKind = 'encore' | 'anxin'

const W = 1024
const H = 160
/** Length of one printed repeat, in ribbon widths. */
const TILE = W / H
const FONT = `'NotoTC', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save()
  g.translate(x, y)
  g.scale(s / 32, s / 32)
  g.beginPath()
  g.moveTo(0, 10)
  g.bezierCurveTo(-26, -6, -14, -26, 0, -12)
  g.bezierCurveTo(14, -26, 26, -6, 0, 10)
  g.closePath()
  g.fillStyle = color
  g.fill()
  g.restore()
}

function draw(g: CanvasRenderingContext2D, kind: RibbonKind) {
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  if (kind === 'encore') {
    g.fillStyle = '#3ca6ea'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#1f7ec4'
    g.fillRect(0, 0, W, 10)
    g.fillRect(0, H - 10, W, 10)
    g.fillStyle = '#ffffff'
    g.font = `900 84px ${FONT}`
    g.fillText('台北安可', 250, H / 2 + 4)
    g.fillText('非你不可', 690, H / 2 + 4)
    g.font = `900 46px ${FONT}`
    g.fillText('◆', 470, H / 2 + 4)
    g.fillText('◆', 950, H / 2 + 4)
  } else {
    g.fillStyle = '#f7f9fc'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#c9d8ee'
    g.fillRect(0, 0, W, 8)
    g.fillRect(0, H - 8, W, 8)
    heart(g, 60, H / 2, 64, '#2f6bff')
    g.fillStyle = '#16161c'
    g.font = `900 80px ${FONT}`
    g.fillText('台北安可', 290, H / 2 + 4)
    heart(g, 530, H / 2, 64, '#ffc400')
    g.font = `900 50px ${FONT}`
    g.fillText('TAIPEI ENCORE', 770, H / 2 + 4)
    heart(g, 990, H / 2, 64, '#e8364a')
  }
}

const cache = new Map<RibbonKind, THREE.CanvasTexture>()

export function ribbonTexture(kind: RibbonKind) {
  let tex = cache.get(kind)
  if (tex) return tex
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  draw(g, kind)
  tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 8
  cache.set(kind, tex)
  const t = tex
  // the web font may still be loading on first paint; reprint once it is ready
  document.fonts?.load(`900 80px NotoTC`, '台北安可').then(() => {
    draw(g, kind)
    t.needsUpdate = true
  })
  return tex
}

/**
 * Lay the print along a PlaneGeometry(width, length): the text runs down the length and repeats. Seen from
 * below (ceiling garlands) the print is flipped across so it does not read mirrored.
 */
export function printAlong(geo: THREE.PlaneGeometry, width: number, length: number, fromBelow = false) {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const repeats = length / (width * TILE)
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    uv.setXY(i, v * repeats, fromBelow ? u : 1 - u)
  }
  uv.needsUpdate = true
  return geo
}
