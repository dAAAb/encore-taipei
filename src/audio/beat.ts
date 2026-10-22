/** Shared tempo for the dance, crowd and lights. The built-in track plays at exactly this tempo. */
export const BPM = 150
export const SEC_PER_BEAT = 60 / BPM

let origin = performance.now() / 1000

/** Realign beat 0 to a moment in seconds (performance clock). */
export function setBeatOrigin(seconds: number) {
  origin = seconds
}

export function beatNow(): number {
  return (performance.now() / 1000 - origin) / SEC_PER_BEAT
}

/** 0 → 1 envelope that spikes on every beat and decays. */
export function pulse(beat: number, sharpness = 6): number {
  const f = beat - Math.floor(beat)
  return Math.exp(-f * sharpness)
}

/** 16-bar form: bars 0–7 verse, 8–15 chorus. */
export function isChorus(beat: number): boolean {
  const bar = Math.floor(beat / 4) % 16
  return bar >= 8
}
