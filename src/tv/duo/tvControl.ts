import { useMemo } from 'react'
import { track } from '@/lib/analytics'
import { channelUrl } from '../routing'
import { useTv } from '../store'
import type { PadState } from './RemotePad'
import type { Color, DialEntry, StageCommand, TvSnapshot } from './protocol'

const dialOf = (dial: ReturnType<typeof useTv.getState>['dial']): DialEntry[] =>
  dial.map((d) => ({ n: d.number, t: d.kind === 'empty' ? '' : d.channel.title, k: d.kind }))

/** The TV's state as sent to paired remotes. */
export function snapshot(entry: string): TvSnapshot {
  const s = useTv.getState()
  const slot = s.dial[s.index]
  return {
    phase: s.phase,
    n: slot?.number ?? null,
    title: slot ? (slot.kind === 'empty' ? '訊號徵求中' : slot.channel.title) : '',
    author: slot && slot.kind !== 'empty' ? slot.channel.author : '',
    kind: slot?.kind ?? null,
    volume: s.volume,
    muted: s.muted,
    entry,
    dial: dialOf(s.dial),
    stage: s.stage,
  }
}

export const stageCommand = (c: StageCommand) => window.dispatchEvent(new CustomEvent('encore:stage', { detail: c }))

export function colorKey(c: Color) {
  window.dispatchEvent(new CustomEvent('encore:color', { detail: c }))
  track('remote_color_key', { color: c })
}

/** The upload key: go to the empty channel and offer the submission form there. */
export function toLastSlot() {
  const s = useTv.getState()
  s.tune(s.dial.length - 1)
  if (s.dial[s.dial.length - 1]?.kind === 'empty') window.setTimeout(() => useTv.getState().setSubmitOpen(true), 500)
}

export async function shareChannel(n: number | null, place: string) {
  if (n == null) return
  const url = channelUrl(n)
  track('share', { method: 'share' in navigator ? 'native' : 'copy', content_type: 'channel', item_id: String(n), place })
  if (navigator.share) await navigator.share({ title: `第 ${n} 台｜台北安可電視台`, url }).catch(() => {})
  else await navigator.clipboard?.writeText(url).catch(() => {})
}

/** The on-device remote (?duo=true) reads the TV store directly. */
export function useLocalPadState(entry: string): PadState {
  const phase = useTv((s) => s.phase)
  const dial = useTv((s) => s.dial)
  const index = useTv((s) => s.index)
  const muted = useTv((s) => s.muted)
  const stage = useTv((s) => s.stage)
  const entries = useMemo(() => dialOf(dial), [dial])
  const slot = dial[index]
  return {
    phase,
    n: slot?.number ?? null,
    title: slot ? (slot.kind === 'empty' ? '訊號徵求中' : slot.channel.title) : '',
    entry,
    muted,
    dial: entries,
    stage,
  }
}
