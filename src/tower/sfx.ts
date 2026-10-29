import { sfx } from "@/tv/sfx";

/** Tower-only sounds on top of the TV's synth: the drone's hover and the elevator chime. */
type Hover = {
  voices: { osc: OscillatorNode; cents: number }[];
  pad: GainNode;
  padFilter: BiquadFilterNode;
  shimmer: GainNode;
  air: GainNode;
  airFilter: BiquadFilterNode;
};
let hover: Hover | null = null;

// A-major pad (A2 E3 A3 C#4), each note doubled a few cents apart so it chorus-shimmers instead of buzzing.
const CHORD = [110, 164.81, 220, 277.18];
const SHIMMER = 1318.5;
// Full speed lifts every voice a major third, so flying reads as a glide rather than a motor revving.
const GLIDE_CENTS = 400;

export function startHum() {
  const ctx = sfx.ctx;
  if (!ctx || !sfx.master || hover) return;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(sfx.master);

  const pad = ctx.createGain();
  pad.gain.value = 0;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 650;
  padFilter.Q.value = 2.5;
  padFilter.connect(pad).connect(out);

  const voices: Hover["voices"] = [];
  CHORD.forEach((f, i) => {
    [-6, 6].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.28;
      o.connect(g).connect(padFilter);
      voices.push({ osc: o, cents });
    });
  });

  // Slow sweep of the pad's filter: the hover breathes rather than throbs.
  const breath = ctx.createOscillator();
  breath.frequency.value = 0.22;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 220;
  breath.connect(breathDepth).connect(padFilter.frequency);

  const shimmer = ctx.createGain();
  shimmer.gain.value = 0;
  const bell = ctx.createOscillator();
  bell.type = "sine";
  bell.frequency.value = SHIMMER;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.2;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 9;
  vibrato.connect(vibratoDepth).connect(bell.detune);
  bell.connect(shimmer).connect(out);
  voices.push({ osc: bell, cents: 0 });

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "bandpass";
  airFilter.frequency.value = 900;
  airFilter.Q.value = 1.4;
  const air = ctx.createGain();
  air.gain.value = 0;
  hiss.connect(airFilter).connect(air).connect(out);

  voices.forEach((v) => v.osc.start());
  breath.start();
  vibrato.start();
  hiss.start();
  hover = { voices, pad, padFilter, shimmer, air, airFilter };
}

/** 0 = idle hover, 1 = flying hard. Silent while inside a floor. */
export function setHum(level: number, on: boolean) {
  if (!hover || !sfx.ctx) return;
  const t = sfx.ctx.currentTime;
  const k = on ? 1 : 0;
  hover.pad.gain.setTargetAtTime(k * (0.05 + level * 0.03), t, 0.35);
  hover.shimmer.gain.setTargetAtTime(k * (0.004 + level * 0.014), t, 0.3);
  hover.air.gain.setTargetAtTime(k * level * 0.05, t, 0.2);
  hover.airFilter.frequency.setTargetAtTime(900 + level * 2600, t, 0.25);
  hover.padFilter.frequency.setTargetAtTime(650 + level * 900, t, 0.3);
  hover.voices.forEach((v) =>
    v.osc.detune.setTargetAtTime(v.cents + level * GLIDE_CENTS, t, 0.35),
  );
}

export function ding() {
  const ctx = sfx.ctx;
  if (!ctx || !sfx.master) return;
  const t = ctx.currentTime;
  [
    [1318.5, 0],
    [1046.5, 0.32],
  ].forEach(([f, at]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(0.22, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.4);
    o.connect(g).connect(sfx.master!);
    o.start(t + at);
    o.stop(t + at + 1.5);
  });
}
