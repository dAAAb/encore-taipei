import { sfx } from '@/tv/sfx'

/** Tower-only sounds on top of the TV's synth: the drone's hum and the elevator chime. */
let hum: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null

export function startHum() {
  const ctx = sfx.ctx
  if (!ctx || !sfx.master || hum) return
  const gain = ctx.createGain()
  gain.gain.value = 0
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 118
  const osc2 = ctx.createOscillator()
  osc2.type = 'square'
  osc2.frequency.value = 237
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 23
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.012
  lfo.connect(lfoGain).connect(gain.gain)
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(gain).connect(sfx.master)
  osc.start()
  osc2.start()
  lfo.start()
  hum = { osc, osc2, gain, filter }
}

/** 0 = idle hover, 1 = flying hard. Silent while inside a floor. */
export function setHum(level: number, on: boolean) {
  if (!hum || !sfx.ctx) return
  const t = sfx.ctx.currentTime
  hum.gain.gain.setTargetAtTime(on ? 0.035 + level * 0.05 : 0, t, 0.25)
  hum.osc.frequency.setTargetAtTime(118 + level * 60, t, 0.2)
  hum.osc2.frequency.setTargetAtTime(237 + level * 120, t, 0.2)
  hum.filter.frequency.setTargetAtTime(700 + level * 1400, t, 0.2)
}

export function ding() {
  const ctx = sfx.ctx
  if (!ctx || !sfx.master) return
  const t = ctx.currentTime
  ;[
    [1318.5, 0],
    [1046.5, 0.32],
  ].forEach(([f, at]) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t + at)
    g.gain.linearRampToValueAtTime(0.22, t + at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.4)
    o.connect(g).connect(sfx.master!)
    o.start(t + at)
    o.stop(t + at + 1.5)
  })
}
