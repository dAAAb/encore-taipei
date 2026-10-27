import * as THREE from 'three'
import type { Floor } from './layout'
import { floorTitle } from './layout'

const BASE = import.meta.env.BASE_URL
const FONT = `'NotoTC', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function toTexture(c: HTMLCanvasElement, mips = true) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = mips
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  t.anisotropy = 4
  return t
}

const hue = (n: number) => (n * 67) % 360

/** A stand-in party for floors without a share image: neon blobs that read as a stage once blurred. */
function partyCard(n: number, title: string) {
  const [c, g] = canvas(600, 315)
  const h = hue(n)
  const bg = g.createLinearGradient(0, 0, 600, 315)
  bg.addColorStop(0, `hsl(${h} 70% 14%)`)
  bg.addColorStop(1, `hsl(${(h + 70) % 360} 70% 8%)`)
  g.fillStyle = bg
  g.fillRect(0, 0, 600, 315)
  for (let i = 0; i < 9; i++) {
    const x = 60 + ((i * 137 + n * 31) % 480)
    const y = 60 + ((i * 89 + n * 17) % 200)
    const r = 40 + ((i * 53) % 70)
    const glow = g.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, `hsla(${(h + i * 40) % 360} 95% 65% / 0.9)`)
    glow.addColorStop(1, 'transparent')
    g.fillStyle = glow
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.fillStyle = '#fff4d6'
  g.font = `900 46px ${FONT}`
  g.textAlign = 'center'
  g.fillText(title.slice(0, 12), 300, 180)
  return toTexture(c)
}

/** Empty storeys: a sharp "for lease" card the visitor can actually read through the glass. */
function leaseCard(n: number, future: boolean) {
  const [c, g] = canvas(600, 315)
  g.fillStyle = future ? '#0d0f16' : '#14120c'
  g.fillRect(0, 0, 600, 315)
  const lamp = g.createRadialGradient(300, 40, 0, 300, 40, 320)
  lamp.addColorStop(0, future ? 'rgba(120,140,190,0.25)' : 'rgba(255,214,120,0.38)')
  lamp.addColorStop(1, 'transparent')
  g.fillStyle = lamp
  g.fillRect(0, 0, 600, 315)
  g.textAlign = 'center'
  if (future) {
    // an empty office after hours: a few lamps left on, the floor number painted on the back wall
    g.fillStyle = '#080a12'
    g.fillRect(0, 0, 600, 315)
    for (let i = 0; i < 4; i++) {
      const x = 70 + ((i * 151 + n * 37) % 460)
      const y = 70 + ((i * 67 + n * 13) % 120)
      const glow = g.createRadialGradient(x, y, 0, x, y, 120)
      glow.addColorStop(0, i % 2 ? 'rgba(255,196,120,0.30)' : 'rgba(140,170,255,0.22)')
      glow.addColorStop(1, 'transparent')
      g.fillStyle = glow
      g.fillRect(x - 120, y - 120, 240, 240)
    }
    g.fillStyle = 'rgba(180,195,235,0.16)'
    g.font = `900 120px ${FONT}`
    g.fillText(String(n), 300, 190)
    g.fillStyle = 'rgba(210,220,245,0.55)'
    g.font = `700 24px ${FONT}`
    g.fillText('即將開放', 300, 270)
    return toTexture(c)
  }
  g.fillStyle = '#ffd400'
  g.fillRect(130, 70, 340, 140)
  g.fillStyle = '#0c0812'
  g.font = `900 64px ${FONT}`
  g.fillText('招租中', 300, 150)
  g.font = `900 24px ${FONT}`
  g.fillText('FOR LEASE', 300, 190)
  g.fillStyle = '#fff4d6'
  g.font = `700 24px ${FONT}`
  g.fillText(`${n} 樓可以是你的舞台・點我進來看看`, 300, 262)
  return toTexture(c)
}

const cache = new Map<string, THREE.Texture>()

/** What a floor looks like through its windows: the stage's share image, or a stand-in. */
export function floorTexture(f: Floor, onReady: () => void): THREE.Texture {
  const key = f.kind === 'future' ? `future:${f.number}` : `${f.slot.kind}:${f.number}:${'channel' in f.slot ? f.slot.channel.url : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  let tex: THREE.Texture
  if (f.kind === 'future') tex = leaseCard(f.number, true)
  else if (f.slot.kind === 'empty') tex = leaseCard(f.number, false)
  else {
    tex = partyCard(f.number, floorTitle(f))
    if (f.slot.kind === 'live') {
      const n = f.number
      const loader = new THREE.TextureLoader()
      const use = (t: THREE.Texture) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        cache.set(key, t)
        Object.assign(tex, { image: t.image })
        tex.needsUpdate = true
        onReady()
      }
      loader.load(`${BASE}og/${n}.jpg`, use, undefined, () => loader.load(`${BASE}og/${n}.png`, use, undefined, () => {}))
    }
  }
  cache.set(key, tex)
  return tex
}

/** The strip under each storey's glass: floor number in elevator green, then the stage's name. */
export function floorLabel(f: Floor) {
  const [c, g] = canvas(2048, 112)
  g.fillStyle = '#07060c'
  g.fillRect(0, 0, 2048, 112)
  g.font = `900 72px ui-monospace, 'DejaVu Sans Mono', monospace`
  g.textBaseline = 'middle'
  g.fillStyle = f.kind === 'future' ? '#4d5a70' : '#b6ffb0'
  g.shadowColor = g.fillStyle
  g.shadowBlur = 16
  g.fillText(`${f.number}F`, 36, 60)
  g.shadowBlur = 0
  g.font = `900 52px ${FONT}`
  g.fillStyle = f.kind === 'future' ? '#5a6274' : f.kind === 'slot' && f.slot.kind === 'empty' ? '#ffd400' : '#fff4d6'
  g.fillText(floorTitle(f).slice(0, 26), 330, 62)
  return toTexture(c, false)
}

export function lobbySign() {
  const [c, g] = canvas(1024, 160)
  g.clearRect(0, 0, 1024, 160)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `900 92px ${FONT}`
  g.fillStyle = '#fff4d6'
  g.shadowColor = '#ff2a4d'
  g.shadowBlur = 24
  g.fillText('台北安可大樓', 512, 66)
  g.shadowBlur = 0
  g.font = `900 34px ${FONT}`
  g.fillStyle = '#ffd400'
  g.fillText('ENCORE TOWER · TAIPEI', 512, 136)
  return toTexture(c, false)
}

/**
 * Bulb positions for the rooftop marquee: the text is rasterised once and sampled on a grid, so each
 * lit cell becomes one bulb. Returns positions in sign units, x centred, y up.
 */
export function bulbLayout(lines: string[], cell = 9) {
  const W = 760
  const H = 130 * lines.length
  const [, g] = canvas(W, H)
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((line, i) => {
    g.font = `900 ${i === 0 ? 118 : 96}px ${FONT}`
    g.fillText(line, W / 2, 65 + i * 130)
  })
  const data = g.getImageData(0, 0, W, H).data
  const pts: [number, number, number][] = []
  for (let y = cell / 2; y < H; y += cell) {
    for (let x = cell / 2; x < W; x += cell) {
      const v = data[(Math.floor(y) * W + Math.floor(x)) * 4]
      if (v > 150) pts.push([(x - W / 2) / cell, (H / 2 - y) / cell, y < 130 ? 0 : 1])
    }
  }
  return { pts, cols: W / cell, rows: H / cell }
}
