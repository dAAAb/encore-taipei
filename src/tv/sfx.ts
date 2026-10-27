/** Everything the TV itself sounds like, synthesised so there are no audio assets to load. */
class Sfx {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private level = 0.7

  private ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.level
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate * 2
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    return this.ctx
  }

  /** Call from a user gesture. */
  async unlock() {
    const ctx = this.ensure()
    if (ctx.state !== 'running') await ctx.resume().catch(() => {})
  }

  setLevel(volume: number, muted: boolean) {
    this.level = muted ? 0 : Math.pow(volume / 100, 1.6)
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.05)
  }

  private noiseSource(filterType: BiquadFilterType, freq: number, q = 0.7) {
    const ctx = this.ensure()
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.loopStart = Math.random()
    const f = ctx.createBiquadFilter()
    f.type = filterType
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(f).connect(g).connect(this.master!)
    return { src, f, g, ctx }
  }

  /** Channel-change static: a hiss burst with a little tube crackle. */
  static(duration = 0.45, amount = 0.32) {
    const { src, g, ctx } = this.noiseSource('bandpass', 3200, 0.4)
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amount, t + 0.02)
    g.gain.setValueAtTime(amount, t + duration * 0.7)
    g.gain.linearRampToValueAtTime(0, t + duration)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  /** Remote button: plastic tick. */
  click() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime(2400, t)
    o.frequency.exponentialRampToValueAtTime(900, t + 0.025)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.05)
  }

  /** CRT power-on: relay thunk, degauss hum, then the faint high whine. */
  powerOn() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const thunk = ctx.createOscillator()
    thunk.frequency.setValueAtTime(120, t)
    thunk.frequency.exponentialRampToValueAtTime(40, t + 0.15)
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.5, t)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    thunk.connect(tg).connect(this.master!)
    thunk.start(t)
    thunk.stop(t + 0.22)

    const hum = ctx.createOscillator()
    hum.type = 'sawtooth'
    hum.frequency.value = 60
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    const hg = ctx.createGain()
    hg.gain.setValueAtTime(0, t)
    hg.gain.linearRampToValueAtTime(0.16, t + 0.08)
    hg.gain.exponentialRampToValueAtTime(0.001, t + 1.1)
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 9
    const wg = ctx.createGain()
    wg.gain.value = 18
    wobble.connect(wg).connect(hum.frequency)
    hum.connect(lp).connect(hg).connect(this.master!)
    hum.start(t)
    wobble.start(t)
    hum.stop(t + 1.2)
    wobble.stop(t + 1.2)

    const whine = ctx.createOscillator()
    whine.frequency.value = 7800
    const wh = ctx.createGain()
    wh.gain.setValueAtTime(0, t + 0.1)
    wh.gain.linearRampToValueAtTime(0.012, t + 0.4)
    wh.gain.exponentialRampToValueAtTime(0.0005, t + 2.4)
    whine.connect(wh).connect(this.master!)
    whine.start(t + 0.1)
    whine.stop(t + 2.5)
    this.static(0.5, 0.18)
  }

  /** Power-off zap as the picture collapses to a dot. */
  powerOff() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(1400, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.42)
  }

  /** Air rushing past, rising or falling. */
  whoosh(duration = 1.1, up = true, amount = 0.5) {
    const { src, f, g, ctx } = this.noiseSource('bandpass', up ? 300 : 3000, 1.2)
    const t = ctx.currentTime
    f.frequency.setValueAtTime(up ? 300 : 3000, t)
    f.frequency.exponentialRampToValueAtTime(up ? 3500 : 250, t + duration)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amount, t + duration * 0.6)
    g.gain.linearRampToValueAtTime(0, t + duration)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  /** Rocket burn: low roar with crackle; returns a stop function. */
  rumble(amount = 0.55) {
    const { src, g, ctx } = this.noiseSource('lowpass', 420, 0.9)
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amount, t + 0.4)
    src.start(t)
    return (fade = 2.5) => {
      const now = ctx.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0, now + fade)
      src.stop(now + fade + 0.1)
    }
  }

  /** Cartoon twinkle: two bell partials. */
  ting() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    for (const [f, a] of [
      [2637, 0.12],
      [3951, 0.06],
      [5274, 0.04],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(a, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      o.connect(g).connect(this.master!)
      o.start(t)
      o.stop(t + 1.5)
    }
  }
}

export const sfx = new Sfx()
