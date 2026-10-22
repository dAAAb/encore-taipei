import { BPM, SEC_PER_BEAT, setBeatOrigin } from './beat'

/**
 * A procedural pop-punk loop (E – B – C#m – A) at the shared BPM, plus crowd screams.
 * Used when the official YouTube track can't play, and for crowd noise on top of it.
 */

const CHORDS = [40, 47, 49, 45]
const LEAD: (number | null)[][] = [
  [71, 68, 71, 76],
  [75, null, 73, 71],
  [73, 73, 71, 68],
  [69, 71, 73, 71],
]

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

class Engine {
  ctx: AudioContext | null = null
  master!: GainNode
  music!: GainNode
  crowd!: GainNode
  noise!: AudioBuffer
  dist!: WaveShaperNode
  timer: number | null = null
  nextStep = 0
  stepIndex = 0
  musicOn = false
  chantOn = true

  ensure() {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(comp)
    this.music = ctx.createGain()
    this.music.gain.value = 0
    this.music.connect(this.master)
    this.crowd = ctx.createGain()
    this.crowd.gain.value = 0.55
    this.crowd.connect(this.master)

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

    this.dist = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1
      curve[i] = Math.tanh(x * 6)
    }
    this.dist.curve = curve
    const guitarTone = ctx.createBiquadFilter()
    guitarTone.type = 'lowpass'
    guitarTone.frequency.value = 3200
    const guitarGain = ctx.createGain()
    guitarGain.gain.value = 0.16
    this.dist.connect(guitarTone).connect(guitarGain).connect(this.music)
    return ctx
  }

  async resume() {
    const ctx = this.ensure()
    if (ctx.state !== 'running') await ctx.resume()
  }

  startMusic() {
    const ctx = this.ensure()
    if (this.musicOn) return
    this.musicOn = true
    const t0 = ctx.currentTime + 0.12
    this.nextStep = t0
    this.stepIndex = 0
    setBeatOrigin(performance.now() / 1000 + 0.12)
    this.music.gain.cancelScheduledValues(ctx.currentTime)
    this.music.gain.setTargetAtTime(0.8, ctx.currentTime, 0.05)
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopMusic() {
    if (!this.ctx || !this.musicOn) return
    this.musicOn = false
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
    window.speechSynthesis?.cancel()
  }

  private schedule() {
    const ctx = this.ctx!
    const step = SEC_PER_BEAT / 4
    while (this.nextStep < ctx.currentTime + 0.15) {
      this.playStep(this.stepIndex, this.nextStep)
      this.nextStep += step
      this.stepIndex++
    }
  }

  private playStep(i: number, t: number) {
    const s16 = i % 16
    const bar = Math.floor(i / 16) % 16
    const chorus = bar >= 8
    const chord = CHORDS[bar % 4]
    const beatInBar = s16 / 4

    if (chorus ? s16 % 4 === 0 : s16 === 0 || s16 === 8 || s16 === 10) this.kick(t)
    if (s16 === 4 || s16 === 12) {
      this.snare(t)
      if (chorus) this.clap(t + 0.01)
    }
    if (s16 % 2 === 0) this.hat(t, chorus ? 0.09 : 0.05, s16 % 4 === 2)
    if (chorus && s16 === 0 && bar % 4 === 0) this.crash(t)

    if (s16 % 2 === 0) {
      this.bass(t, chord - 12)
      this.guitar(t, chord, chorus ? 0.28 : 0.1, chorus)
    }

    if (chorus && s16 % 4 === 0) {
      const note = LEAD[bar % 4][Math.floor(beatInBar)]
      if (note) this.lead(t, note)
    }

    if (chorus && this.chantOn && s16 === 0 && bar % 2 === 0) {
      const delay = Math.max(0, (t - this.ctx!.currentTime) * 1000)
      window.setTimeout(() => this.chant(), delay)
    }
    if (chorus && s16 === 0 && bar === 8) this.scream(1)
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    this.env(g, t, 0.95, 0.002, 0.32)
    o.connect(g).connect(this.music)
    o.start(t)
    o.stop(t + 0.4)
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, dest: AudioNode = this.music) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, t, peak, 0.002, decay)
    src.connect(f).connect(g).connect(dest)
    src.start(t, Math.random() * 1.5)
    src.stop(t + decay + 0.05)
  }

  private snare(t: number) {
    this.noiseHit(t, 'bandpass', 1900, 0.7, 0.55, 0.18)
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08)
    this.env(g, t, 0.35, 0.002, 0.1)
    o.connect(g).connect(this.music)
    o.start(t)
    o.stop(t + 0.15)
  }

  private clap(t: number) {
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.012, 'bandpass', 1200, 1.2, 0.3, 0.07)
  }

  private hat(t: number, vol: number, open: boolean) {
    this.noiseHit(t, 'highpass', 8000, 0.8, vol, open ? 0.12 : 0.035)
  }

  private crash(t: number) {
    this.noiseHit(t, 'highpass', 5000, 0.4, 0.22, 1.2)
  }

  private bass(t: number, note: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = midi(note)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 420
    const g = ctx.createGain()
    this.env(g, t, 0.22, 0.005, SEC_PER_BEAT * 0.45)
    o.connect(f).connect(g).connect(this.music)
    o.start(t)
    o.stop(t + SEC_PER_BEAT * 0.5)
  }

  private guitar(t: number, root: number, length: number, open: boolean) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    this.env(g, t, open ? 0.9 : 0.6, 0.004, length)
    g.connect(this.dist)
    for (const [n, det] of [[root, -6], [root, 6], [root + 7, 0], [root + 12, 3]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = midi(n)
      o.detune.value = det
      o.connect(g)
      o.start(t)
      o.stop(t + length + 0.05)
    }
  }

  private lead(t: number, note: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.01, SEC_PER_BEAT * 0.9)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2600
    g.connect(f).connect(this.music)
    for (const [type, det] of [['square', -5], ['triangle', 5]] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = midi(note)
      o.detune.value = det
      o.connect(g)
      o.start(t)
      o.stop(t + SEC_PER_BEAT)
    }
  }

  private chant() {
    const synth = window.speechSynthesis
    if (!synth || !this.musicOn) return
    const u = new SpeechSynthesisUtterance('台北！安可！')
    u.lang = 'zh-TW'
    u.rate = 1.35
    u.pitch = 1.3
    u.volume = 0.85
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'))
    if (voice) u.voice = voice
    synth.speak(u)
  }

  /** Crowd roar: layered band-passed noise swelling in and out. */
  scream(intensity = 0.6) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime + 0.02
    const dur = 1.2 + intensity * 1.4
    for (const [freq, q] of [[900, 1.1], [1700, 1.6], [2900, 2.2]] as const) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.setValueAtTime(freq * 0.8, t)
      f.frequency.linearRampToValueAtTime(freq * 1.15, t + dur * 0.4)
      f.frequency.linearRampToValueAtTime(freq, t + dur)
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.32 * intensity, t + 0.25)
      g.gain.linearRampToValueAtTime(0.22 * intensity, t + dur * 0.6)
      g.gain.linearRampToValueAtTime(0.0001, t + dur)
      src.connect(f).connect(g).connect(this.crowd)
      src.start(t, Math.random())
      src.stop(t + dur + 0.1)
    }
  }
}

export const engine = new Engine()
export { BPM }
