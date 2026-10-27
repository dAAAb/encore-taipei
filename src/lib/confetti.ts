import type { Vec } from './motion'

/**
 * 體感安可: confetti, paper dots and streamers on a 2D canvas over the club.
 * Gravity can point anywhere (the phone's tilt) and gusts push the air, so anything still
 * floating changes course; pieces leave once they drift off the side gravity pulls them to.
 */

const COLORS = ['#ffd400', '#ff2a4d', '#2ef2ff', '#7dff7a', '#ffffff', '#b46bff', '#ff8a00', '#f5c542']
const BACKS = ['#b89900', '#a8142f', '#14a4ad', '#3fae3c', '#c9c9d6', '#7432b8', '#b05e00', '#a8842a']
const TRAIL = 18
const LIFE = 15

interface Bit {
  kind: 'chip' | 'dot'
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  spin: number
  flip: number
  flipRate: number
  drag: number
  sway: number
  swayRate: number
  phase: number
  color: number
  age: number
}

interface Ribbon {
  x: number
  y: number
  vx: number
  vy: number
  drag: number
  sway: number
  swayRate: number
  phase: number
  width: number
  color: number
  age: number
  trail: number[]
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = () => Math.floor(Math.random() * COLORS.length)

export class Confetti {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private bits: Bit[] = []
  private ribbons: Ribbon[] = []
  private raf = 0
  private last = 0
  private t = 0
  private w = 0
  private h = 0
  private dpr = 1
  private gravity: Vec = { x: 0, y: 1 }
  private gravityTarget: Vec = { x: 0, y: 1 }
  private air: Vec = { x: 0, y: 0 }
  private tiltUntil = 0
  private ro: ResizeObserver | null = null
  readonly lite: boolean

  constructor(lite: boolean) {
    this.lite = lite
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    return () => {
      this.ro?.disconnect()
      cancelAnimationFrame(this.raf)
      this.raf = 0
      this.canvas = null
      this.ctx = null
      this.bits = []
      this.ribbons = []
    }
  }

  get alive() {
    return this.bits.length + this.ribbons.length
  }

  /** Where "down" is, in g; null goes back to the screen's own down. `hold` keeps it that long without fresh readings. */
  tilt(g: Vec | null, hold = 0) {
    if (!g) {
      this.gravityTarget = { x: 0, y: 1 }
      return
    }
    const m = Math.hypot(g.x, g.y)
    // Lying flat there is little pull across the screen; a hint of the screen's down keeps things from hovering forever.
    const bias = Math.max(0, 0.22 - m)
    this.gravityTarget = { x: g.x, y: g.y + bias }
    if (hold) this.tiltUntil = performance.now() + hold
  }

  /** Throw the air (and everything in it) one way. strength 1 ≈ a firm shake. */
  gust(dir: Vec, strength = 1) {
    const s = Math.min(2, strength) * this.h
    this.air.x += dir.x * s * 0.9
    this.air.y += dir.y * s * 0.9
    for (const b of this.bits) {
      const k = rand(0.35, 0.75) * s
      b.vx += dir.x * k
      b.vy += dir.y * k
      b.flipRate *= 1.4
    }
    for (const r of this.ribbons) {
      r.vx += dir.x * s * 0.6
      r.vy += dir.y * s * 0.6
    }
    this.run()
  }

  /** The pointer moving pulls a little air along with it. */
  sweep(v: Vec) {
    if (!this.alive) return
    this.air.x += v.x * 0.05
    this.air.y += v.y * 0.05
  }

  /** Two cannons near the corners of the edge gravity pulls toward fire back up across the screen. */
  burst(power = 1) {
    if (!this.ctx || !this.w) return
    const p = Math.max(0.35, Math.min(1.4, power))
    const cap = this.lite ? 380 : 720
    const ribbonCap = this.lite ? 26 : 48
    const room = Math.max(0, cap - this.bits.length)
    const g = this.gravity
    const gl = Math.hypot(g.x, g.y) || 1
    const down = { x: g.x / gl, y: g.y / gl }
    const along = { x: -down.y, y: down.x }
    // The spot where an "up" ray from the center leaves the screen, then a cannon either side of it.
    const cx = this.w / 2
    const cy = this.h / 2
    const tx = down.x ? Math.abs(cx / down.x) : Infinity
    const ty = down.y ? Math.abs(cy / down.y) : Infinity
    const reach = Math.min(tx, ty)
    const ex = cx + down.x * reach
    const ey = cy + down.y * reach
    const span = Math.abs(along.x) * this.w + Math.abs(along.y) * this.h
    const perSide = Math.round((this.lite ? 75 : 130) * p)
    const H = Math.max(this.w, this.h) * 0.62 + Math.min(this.w, this.h) * 0.38

    for (const side of [-1, 1]) {
      const ox = ex + along.x * side * span * 0.44
      const oy = ey + along.y * side * span * 0.44
      // Aim from straight up to ~45° toward the middle, so the two sprays meet over the stage.
      const aim = (spread: number) => {
        const a = rand(0.06, spread)
        return { x: -down.x * Math.cos(a) - along.x * side * Math.sin(a), y: -down.y * Math.cos(a) - along.y * side * Math.sin(a) }
      }
      const n = Math.min(perSide, Math.floor(room / 2))
      for (let i = 0; i < n; i++) {
        const speed = rand(1.3, 2.7) * H
        const dir = aim(0.8)
        const dot = Math.random() < 0.22
        this.bits.push({
          kind: dot ? 'dot' : 'chip',
          x: ox + rand(-12, 12),
          y: oy + rand(-12, 12),
          vx: dir.x * speed,
          vy: dir.y * speed,
          w: dot ? rand(7, 11) : rand(7, 13),
          h: dot ? 0 : rand(3.5, 6.5),
          rot: rand(0, Math.PI * 2),
          spin: rand(-7, 7),
          flip: rand(0, Math.PI * 2),
          flipRate: rand(5, 13),
          drag: dot ? rand(2.1, 3.0) : rand(2.6, 3.8),
          sway: rand(0.06, 0.16),
          swayRate: rand(2, 4.5),
          phase: rand(0, Math.PI * 2),
          color: pick(),
          age: 0,
        })
      }
      const rn = Math.min(Math.round((this.lite ? 5 : 8) * p), Math.max(0, Math.floor((ribbonCap - this.ribbons.length) / 2)))
      for (let i = 0; i < rn; i++) {
        const speed = rand(1.2, 2.2) * H
        const dir = aim(0.75)
        const x = ox + rand(-8, 8)
        const y = oy + rand(-8, 8)
        this.ribbons.push({
          x,
          y,
          vx: dir.x * speed,
          vy: dir.y * speed,
          drag: rand(2.8, 3.6),
          sway: rand(0.24, 0.42),
          swayRate: rand(3.5, 5.5),
          phase: rand(0, Math.PI * 2),
          width: rand(4.5, 7),
          color: pick(),
          age: 0,
          trail: Array.from({ length: TRAIL }, () => [x, y]).flat(),
        })
      }
    }
    this.run()
  }

  private resize() {
    const c = this.canvas
    if (!c) return
    this.dpr = Math.min(this.lite ? 1.5 : 2, window.devicePixelRatio || 1)
    this.w = c.clientWidth
    this.h = c.clientHeight
    c.width = Math.round(this.w * this.dpr)
    c.height = Math.round(this.h * this.dpr)
  }

  private run() {
    if (this.raf || !this.ctx) return
    this.last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - this.last) / 1000)
      this.last = now
      this.step(dt, now)
      this.draw()
      this.raf = this.alive ? requestAnimationFrame(loop) : 0
      if (!this.raf) this.ctx?.clearRect(0, 0, this.canvas!.width, this.canvas!.height)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private step(dt: number, now: number) {
    this.t += dt
    if (this.tiltUntil && now > this.tiltUntil) {
      this.tiltUntil = 0
      this.gravityTarget = { x: 0, y: 1 }
    }
    const ease = 1 - Math.exp(-dt * 5)
    this.gravity.x += (this.gravityTarget.x - this.gravity.x) * ease
    this.gravity.y += (this.gravityTarget.y - this.gravity.y) * ease
    const calm = Math.exp(-dt * 1.4)
    this.air.x *= calm
    this.air.y *= calm

    const H = Math.min(this.w, this.h)
    const G = 1.15 * H
    const gx = this.gravity.x * G
    const gy = this.gravity.y * G
    const gl = Math.hypot(this.gravity.x, this.gravity.y) || 1
    const px = -this.gravity.y / gl
    const py = this.gravity.x / gl
    const margin = 80

    const gone = (x: number, y: number, vx: number, vy: number, age: number) =>
      age > LIFE ||
      (x < -margin && vx <= 0) ||
      (x > this.w + margin && vx >= 0) ||
      (y < -margin && vy <= 0) ||
      (y > this.h + margin && vy >= 0)

    let n = 0
    for (const b of this.bits) {
      b.age += dt
      const s = Math.sin(this.t * b.swayRate + b.phase) * b.sway * H
      const ax = this.air.x + px * s
      const ay = this.air.y + py * s
      b.vx += (gx + b.drag * (ax - b.vx)) * dt
      b.vy += (gy + b.drag * (ay - b.vy)) * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.spin * dt
      b.flipRate += (8 - b.flipRate) * dt * 0.8
      b.flip += b.flipRate * dt
      if (!gone(b.x, b.y, b.vx, b.vy, b.age)) this.bits[n++] = b
    }
    this.bits.length = n

    n = 0
    for (const r of this.ribbons) {
      r.age += dt
      const s = Math.sin(this.t * r.swayRate + r.phase) * r.sway * H
      const ax = this.air.x + px * s
      const ay = this.air.y + py * s
      r.vx += (gx * 0.75 + r.drag * (ax - r.vx)) * dt
      r.vy += (gy * 0.75 + r.drag * (ay - r.vy)) * dt
      r.x += r.vx * dt
      r.y += r.vy * dt
      const tr = r.trail
      const dx = r.x - tr[0]
      const dy = r.y - tr[1]
      const seg = 4.5
      if (dx * dx + dy * dy > seg * seg) {
        tr.unshift(r.x, r.y)
        tr.length = TRAIL * 2
      } else {
        tr[0] = r.x
        tr[1] = r.y
      }
      const tx = tr[tr.length - 2]
      const ty = tr[tr.length - 1]
      const tailOut = tx < -margin || tx > this.w + margin || ty < -margin || ty > this.h + margin
      if (r.age <= LIFE && !(tailOut && gone(r.x, r.y, r.vx, r.vy, r.age))) this.ribbons[n++] = r
    }
    this.ribbons.length = n
  }

  private draw() {
    const ctx = this.ctx
    if (!ctx) return
    const d = this.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const r of this.ribbons) {
      const a = r.age > LIFE - 1 ? Math.max(0, LIFE - r.age) : 1
      ctx.globalAlpha = a
      const tr = r.trail
      ctx.setTransform(d, 0, 0, d, 0, 0)
      // Curves through the midpoints, one stroke per segment so the band can twist (width and face color).
      let mx = tr[0]
      let my = tr[1]
      for (let i = 2; i < tr.length - 2; i += 2) {
        const nx = (tr[i] + tr[i + 2]) / 2
        const ny = (tr[i + 1] + tr[i + 3]) / 2
        const twist = Math.abs(Math.cos(i * 0.3 + this.t * 6 + r.phase))
        ctx.lineWidth = 1 + r.width * twist
        ctx.strokeStyle = twist > 0.45 ? COLORS[r.color] : BACKS[r.color]
        ctx.beginPath()
        ctx.moveTo(mx, my)
        ctx.quadraticCurveTo(tr[i], tr[i + 1], nx, ny)
        ctx.stroke()
        mx = nx
        my = ny
      }
    }

    for (const b of this.bits) {
      const a = b.age > LIFE - 1 ? Math.max(0, LIFE - b.age) : 1
      const f = Math.cos(b.flip)
      const cos = Math.cos(b.rot)
      const sin = Math.sin(b.rot)
      ctx.globalAlpha = a
      ctx.fillStyle = f >= 0 ? COLORS[b.color] : BACKS[b.color]
      ctx.setTransform(cos * d, sin * d, -sin * f * d, cos * f * d, b.x * d, b.y * d)
      if (b.kind === 'dot') {
        ctx.beginPath()
        ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
      }
    }
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}
