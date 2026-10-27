import { sfx } from '../sfx'
import type { Cue } from './Montage'

const BASE = import.meta.env.BASE_URL

export async function loadNarrationDurations(): Promise<number[]> {
  try {
    const res = await fetch(`${BASE}montage/narration.json`)
    const data = (await res.json()) as { durations: number[] }
    return data.durations
  } catch {
    return []
  }
}

/** Plays each cue's voice-over once, on the TV's own audio graph so the remote's volume applies. */
export class Narrator {
  private buffers = new Map<string, AudioBuffer>()
  private played = new Set<number>()
  private sources: AudioBufferSourceNode[] = []
  private cues: Cue[]

  constructor(cues: Cue[]) {
    this.cues = cues
  }

  async load() {
    const ctx = sfx.ctx
    if (!ctx) return
    await Promise.all(
      this.cues.map(async (c) => {
        try {
          const data = await fetch(c.audio).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          this.buffers.set(c.audio, await ctx.decodeAudioData(data))
        } catch {
          /* a missing clip just leaves that segment silent */
        }
      }),
    )
  }

  update(t: number) {
    const ctx = sfx.ctx
    if (!ctx || !sfx.master) return
    this.cues.forEach((c, i) => {
      if (this.played.has(i) || t < c.at) return
      this.played.add(i)
      if (t > c.at + 1.5) return
      const buf = this.buffers.get(c.audio)
      if (!buf) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(sfx.master!)
      src.start()
      this.sources.push(src)
    })
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* already finished */
      }
    }
    this.sources = []
  }
}
