import { SEGMENTS, type Era, type Segment } from './segments'

const BASE = import.meta.env.BASE_URL
const FONT = `'NotoTC', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`

type Shot =
  | { kind: 'snow'; t0: number; t1: number; era: Era }
  | { kind: 'leader'; t0: number; t1: number; era: Era }
  | { kind: 'title'; t0: number; t1: number; era: Era }
  | { kind: 'segment'; t0: number; t1: number; era: Era; seg: Segment; index: number }
  | { kind: 'finale'; t0: number; t1: number; era: Era }

export interface Cue {
  at: number
  audio: string
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/**
 * The newsreel drawn into a 2D canvas that the TV screen samples. Pure function of time, so the
 * 3D camera, the TV model swaps and the narration all hang off the same clock.
 */
export class Montage {
  readonly canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private images = new Map<string, HTMLImageElement>()
  private noise = document.createElement('canvas')
  readonly shots: Shot[] = []
  readonly cues: Cue[] = []
  readonly total: number
  /** When the camera should start its final push into the screen. */
  readonly pushAt: number

  constructor(narrationSeconds: number[], quick = false) {
    this.canvas.width = 960
    this.canvas.height = 720
    this.noise.width = 160
    this.noise.height = 120
    let t = 0
    const add = (s: Shot) => {
      this.shots.push(s)
      t = s.t1
    }
    if (quick) {
      add({ kind: 'snow', t0: 0, t1: 0.9, era: 'hd' })
      add({ kind: 'finale', t0: t, t1: t + 1.8, era: 'hd' })
      add({ kind: 'snow', t0: t, t1: t + 0.9, era: 'hd' })
    } else {
      add({ kind: 'snow', t0: 0, t1: 0.9, era: 'film' })
      add({ kind: 'leader', t0: t, t1: t + 2.0, era: 'film' })
      add({ kind: 'title', t0: t, t1: t + 1.8, era: 'film' })
      SEGMENTS.forEach((seg, index) => {
        const d = Math.max(4.2, (narrationSeconds[index] ?? 4) + 0.7)
        this.cues.push({ at: t + 0.35, audio: `${BASE}montage/vo-${seg.id}.mp3` })
        add({ kind: 'segment', t0: t, t1: t + d, era: seg.era, seg, index })
      })
      this.cues.push({ at: t + 0.3, audio: `${BASE}montage/vo-finale.mp3` })
      add({ kind: 'finale', t0: t, t1: t + Math.max(3.2, (narrationSeconds[SEGMENTS.length] ?? 2.4) + 1.0), era: 'hd' })
      add({ kind: 'snow', t0: t, t1: t + 1.1, era: 'hd' })
    }
    this.total = t
    this.pushAt = this.total - (quick ? 2.4 : 3.6)
  }

  load() {
    for (const seg of SEGMENTS)
      for (const file of seg.images) {
        if (this.images.has(file)) continue
        const img = new Image()
        img.decoding = 'async'
        img.src = `${BASE}montage/${file}`
        this.images.set(file, img)
      }
  }

  shotAt(t: number) {
    return this.shots.find((s) => t < s.t1) ?? this.shots[this.shots.length - 1]
  }

  eraAt(t: number): Era {
    return this.shotAt(t).era
  }

  setAspect(aspect: number) {
    const h = 720
    const w = Math.round(h * aspect)
    if (this.canvas.width !== w) {
      this.canvas.width = w
      this.canvas.height = h
      return true
    }
    return false
  }

  draw(t: number) {
    const shot = this.shotAt(t)
    const { ctx } = this
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.save()
    ctx.clearRect(0, 0, w, h)
    const local = t - shot.t0
    switch (shot.kind) {
      case 'snow':
        this.drawSnow(w, h, 1)
        break
      case 'leader':
        this.drawLeader(w, h, local, shot.t1 - shot.t0)
        break
      case 'title':
        this.drawTitle(w, h, local)
        break
      case 'segment':
        this.drawSegment(w, h, local, shot.t1 - shot.t0, shot.seg, shot.index)
        break
      case 'finale':
        this.drawFinale(w, h, local)
        break
    }
    ctx.restore()
    if (shot.era === 'film') this.filmDamage(w, h, t)
  }

  private drawSnow(w: number, h: number, amount: number) {
    const n = this.noise.getContext('2d')!
    const img = n.createImageData(this.noise.width, this.noise.height)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 * amount
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    n.putImageData(img, 0, 0)
    this.ctx.imageSmoothingEnabled = false
    this.ctx.drawImage(this.noise, 0, 0, w, h)
    this.ctx.imageSmoothingEnabled = true
  }

  /** Academy leader: the sweeping countdown at the head of every newsreel reel. */
  private drawLeader(w: number, h: number, local: number, d: number) {
    const { ctx } = this
    const count = Math.max(1, 3 - Math.floor((local / d) * 3))
    const frac = ((local / d) * 3) % 1
    ctx.fillStyle = '#8a8a8a'
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    const r = h * 0.42
    ctx.fillStyle = '#5a5a5a'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r * 1.6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#f2f2f2'
    ctx.lineWidth = 6
    for (const rr of [r, r * 0.84]) {
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(w, cy)
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, h)
    ctx.stroke()
    ctx.fillStyle = '#111'
    ctx.font = `900 ${h * 0.5}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count), cx, cy + h * 0.03)
  }

  private drawTitle(w: number, h: number, local: number) {
    const { ctx } = this
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, w, h)
    const s = Math.min(1, local / 0.35)
    ctx.translate(w / 2, h / 2)
    ctx.scale(0.9 + 0.1 * s, 0.9 + 0.1 * s)
    ctx.strokeStyle = '#eaeaea'
    ctx.lineWidth = 5
    ctx.strokeRect(-w * 0.38, -h * 0.3, w * 0.76, h * 0.6)
    ctx.lineWidth = 2
    ctx.strokeRect(-w * 0.36, -h * 0.27, w * 0.72, h * 0.54)
    ctx.fillStyle = '#f2f2f2'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 ${h * 0.15}px ${FONT}`
    ctx.fillText('台北安可', 0, -h * 0.06)
    ctx.font = `700 ${h * 0.065}px ${FONT}`
    ctx.fillText('新 聞 特 輯', 0, h * 0.13)
  }

  private image(file: string | undefined) {
    if (!file) return null
    const img = this.images.get(file)
    return img && img.complete && img.naturalWidth > 0 ? img : null
  }

  private cover(img: HTMLImageElement, w: number, h: number, zoom: number, px: number, py: number) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom
    const dw = img.naturalWidth * s
    const dh = img.naturalHeight * s
    this.ctx.drawImage(img, (w - dw) / 2 + px * (dw - w) * 0.5, (h - dh) / 2 + py * (dh - h) * 0.5, dw, dh)
  }

  private drawSegment(w: number, h: number, local: number, d: number, seg: Segment, index: number) {
    const { ctx } = this
    const files = seg.images
    const cutLen = files.length ? Math.max(1.1, d / Math.max(files.length, 2)) : d
    const cut = Math.floor(local / cutLen)
    const inCut = (local % cutLen) / cutLen
    const img = this.image(files.length ? files[cut % files.length] : undefined)
    const seed = index * 10 + cut
    if (img) {
      const z0 = 1.04 + hash(seed) * 0.12
      const z1 = 1.0 + hash(seed + 3) * 0.06
      const px = (hash(seed + 5) - 0.5) * 1.6
      const py = (hash(seed + 7) - 0.5) * 1.2
      this.cover(img, w, h, z0 + (z1 - z0) * inCut, px * (1 - inCut * 2), py)
    } else {
      const g = ctx.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, seg.tint[0])
      g.addColorStop(1, seg.tint[1])
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 0.18
      ctx.fillStyle = '#fff'
      ctx.font = `900 ${h * 0.5}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(seg.year, w / 2 + Math.sin(local) * 10, h / 2)
      ctx.globalAlpha = 1
    }

    if (seg.era === 'film') this.filmCaption(w, h, local, seg)
    else if (seg.era === 'crt') this.vhsCaption(w, h, local, seg)
    else this.hdCaption(w, h, local, seg)
  }

  private filmCaption(w: number, h: number, local: number, seg: Segment) {
    const { ctx } = this
    if (local < 1.1) {
      const a = Math.min(1, local / 0.15) * Math.min(1, (1.1 - local) / 0.25)
      ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = a
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `900 ${h * 0.24}px ${FONT}`
      ctx.fillText(seg.year, w / 2, h * 0.47)
      ctx.globalAlpha = 1
      return
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `900 ${h * 0.072}px ${FONT}`
    ctx.lineWidth = h * 0.012
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.fillStyle = '#fff'
    ctx.strokeText(seg.headline, w / 2, h * 0.84)
    ctx.fillText(seg.headline, w / 2, h * 0.84)
    ctx.font = `700 ${h * 0.045}px ${FONT}`
    ctx.strokeText(seg.sub, w / 2, h * 0.92)
    ctx.fillText(seg.sub, w / 2, h * 0.92)
  }

  private vhsCaption(w: number, h: number, local: number, seg: Segment) {
    const { ctx } = this
    ctx.font = `700 ${h * 0.05}px ui-monospace, Menlo, Consolas, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 3
    ctx.fillText(`PLAY ▶  ${seg.year}`, w * 0.06, h * 0.07)
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    const slide = Math.min(1, local / 0.45)
    const bx = -w * (1 - slide)
    ctx.fillStyle = 'rgba(16,40,120,0.88)'
    ctx.fillRect(bx, h * 0.74, w * 0.86, h * 0.11)
    ctx.fillStyle = '#ffd400'
    ctx.fillRect(bx, h * 0.74, w * 0.16, h * 0.11)
    ctx.fillStyle = '#0c0812'
    ctx.font = `900 ${h * 0.06}px ${FONT}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(seg.year, bx + w * 0.08, h * 0.795)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `900 ${h * 0.062}px ${FONT}`
    ctx.fillText(seg.headline, bx + w * 0.19, h * 0.795)
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(bx, h * 0.85, w * 0.86, h * 0.065)
    ctx.fillStyle = '#e8ecff'
    ctx.font = `700 ${h * 0.04}px ${FONT}`
    ctx.fillText(seg.sub, bx + w * 0.03, h * 0.884)
    if (Math.floor(local * 7) % 11 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(0, h * (0.2 + hash(Math.floor(local * 7)) * 0.6), w, h * 0.03)
    }
  }

  private hdCaption(w: number, h: number, local: number, seg: Segment) {
    const { ctx } = this
    const slide = Math.min(1, local / 0.35)
    const ease = 1 - (1 - slide) ** 3
    const x = w * 0.05 - w * 0.5 * (1 - ease)
    ctx.fillStyle = '#d0021b'
    ctx.fillRect(x, h * 0.72, h * 0.2, h * 0.075)
    ctx.fillStyle = '#fff'
    ctx.font = `900 ${h * 0.045}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(seg.year, x + h * 0.1, h * 0.7575)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fillRect(x + h * 0.2, h * 0.72, w * 0.62, h * 0.075)
    ctx.fillStyle = '#0b1630'
    ctx.textAlign = 'left'
    ctx.font = `900 ${h * 0.05}px ${FONT}`
    ctx.fillText(seg.headline, x + h * 0.23, h * 0.7575)
    ctx.fillStyle = 'rgba(11,22,48,0.88)'
    ctx.fillRect(x, h * 0.795, w * 0.62 + h * 0.2, h * 0.06)
    ctx.fillStyle = '#c9d3ff'
    ctx.font = `700 ${h * 0.036}px ${FONT}`
    ctx.fillText(seg.sub, x + h * 0.03, h * 0.825)
    ctx.fillStyle = '#0b1630'
    ctx.fillRect(0, h * 0.92, w, h * 0.08)
    ctx.fillStyle = '#ffd400'
    ctx.fillRect(0, h * 0.92, h * 0.22, h * 0.08)
    ctx.fillStyle = '#0b1630'
    ctx.font = `900 ${h * 0.036}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('台北安可', h * 0.11, h * 0.96)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${h * 0.034}px ${FONT}`
    const ticker = '十大建設 → 新竹科學園區 → 台積電 → 免簽走天下 → 北門重見天日 → 公館圓環打通 → 下一個十年？　'
    const tw = ctx.measureText(ticker).width
    const off = (local * w * 0.12) % tw
    ctx.save()
    ctx.beginPath()
    ctx.rect(h * 0.22, h * 0.92, w, h * 0.08)
    ctx.clip()
    for (let k = 0; k < 3; k++) ctx.fillText(ticker, h * 0.26 - off + k * tw, h * 0.962)
    ctx.restore()
  }

  private drawFinale(w: number, h: number, local: number) {
    const { ctx } = this
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#0b1a4a')
    g.addColorStop(0.55, '#1f4fd1')
    g.addColorStop(1, '#ff2a4d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + local * 0.25
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,212,0,0.07)'
      ctx.beginPath()
      ctx.moveTo(w / 2, h / 2)
      ctx.arc(w / 2, h / 2, Math.max(w, h), a, a + Math.PI / 14)
      ctx.closePath()
      ctx.fill()
    }
    const pop = Math.min(1, local / 0.4)
    const s = 0.7 + 0.3 * (1 - (1 - pop) ** 3)
    ctx.save()
    ctx.translate(w / 2, h * 0.46)
    ctx.scale(s, s)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 ${h * 0.075}px ${FONT}`
    ctx.fillStyle = '#ffd400'
    ctx.fillText('下一個十年', 0, -h * 0.16)
    ctx.font = `900 ${h * 0.2}px ${FONT}`
    ctx.lineWidth = h * 0.02
    ctx.strokeStyle = '#0c0812'
    ctx.strokeText('台北安可', 0, h * 0.02)
    ctx.fillStyle = '#fff7e6'
    ctx.fillText('台北安可', 0, h * 0.02)
    ctx.restore()
    if (local > 1.0) {
      ctx.globalAlpha = Math.min(1, (local - 1.0) / 0.4)
      ctx.fillStyle = '#0c0812'
      ctx.fillRect(w / 2 - h * 0.25, h * 0.74, h * 0.5, h * 0.09)
      ctx.fillStyle = '#b6ffb0'
      ctx.font = `900 ${h * 0.055}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('CH 2026 ▶', w / 2, h * 0.785)
      ctx.globalAlpha = 1
    }
  }

  /** Dust, scratches and exposure flicker on top of the black-and-white reels. */
  private filmDamage(w: number, h: number, t: number) {
    const { ctx } = this
    const f = Math.floor(t * 18)
    ctx.fillStyle = `rgba(255,255,255,${0.04 * hash(f)})`
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 2; i++) {
      if (hash(f + i * 13) > 0.55) continue
      const x = hash(f * 3 + i) * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + (hash(f + 9) - 0.5) * 8, h)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    for (let i = 0; i < 6; i++) {
      if (hash(f * 7 + i) > 0.35) continue
      ctx.beginPath()
      ctx.arc(hash(f + i * 31) * w, hash(f + i * 17) * h, 1 + hash(f + i) * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
