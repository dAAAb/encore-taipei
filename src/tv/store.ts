import { create } from 'zustand'
import { FALLBACK_CHANNELS, FIRST_CHANNEL, type Channel } from './channel-data'

/**
 * gate   dark room, TV off, waiting for the first tap (audio needs a gesture)
 * intro  the newsreel montage while the camera dollies into the screen
 * tv     full-screen channel surfing
 * off    power-off finale: rocket launch, Earth, starry face, credits; the slit leads back to the gate
 */
export type Phase = 'gate' | 'intro' | 'tv' | 'off'

export interface PendingStage extends Channel {
  submittedAt: string
}

/** One stop on the dial: a live channel, the visitor's own pending stage, or the empty slot. */
export type Slot =
  | { kind: 'live'; number: number; channel: Channel }
  | { kind: 'pending'; number: number; channel: PendingStage }
  | { kind: 'empty'; number: number }

const PENDING_KEY = 'encore.pending'
const VOLUME_KEY = 'encore.volume'

function loadPending(): PendingStage | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingStage) : null
  } catch {
    return null
  }
}

export function buildDial(channels: Channel[], pending: PendingStage | null): Slot[] {
  const live: Slot[] = channels.map((c) => ({ kind: 'live', number: c.channel, channel: c }))
  const next = Math.max(FIRST_CHANNEL - 1, ...channels.map((c) => c.channel)) + 1
  const approved = pending && channels.some((c) => c.url === pending.url)
  if (pending && !approved) return [...live, { kind: 'pending', number: next, channel: { ...pending, channel: next } }]
  return [...live, { kind: 'empty', number: next }]
}

interface TvState {
  phase: Phase
  channels: Channel[]
  channelsLoaded: boolean
  pending: PendingStage | null
  dial: Slot[]
  index: number
  volume: number
  muted: boolean
  /** Bumped on every channel/volume change so the on-screen display re-appears. */
  osdNonce: number
  osdKind: 'channel' | 'volume'
  infoOpen: boolean
  submitOpen: boolean
  guideOpen: boolean
  /** The channel the visitor deep-linked to; the intro is shortened for them. */
  deepLink: number | null
  setPhase: (p: Phase) => void
  setChannels: (c: Channel[]) => void
  setPending: (p: PendingStage | null) => void
  tune: (index: number) => void
  step: (delta: number) => void
  tuneNumber: (n: number) => boolean
  setVolume: (v: number) => void
  toggleMute: () => void
  setInfoOpen: (v: boolean) => void
  setSubmitOpen: (v: boolean) => void
  setGuideOpen: (v: boolean) => void
}

const initialPending = loadPending()
const initialDial = buildDial(FALLBACK_CHANNELS, initialPending)

export const useTv = create<TvState>((set, get) => ({
  phase: 'gate',
  channels: FALLBACK_CHANNELS,
  channelsLoaded: false,
  pending: initialPending,
  dial: initialDial,
  index: 0,
  volume: Number(localStorage.getItem(VOLUME_KEY) ?? 70),
  muted: false,
  osdNonce: 0,
  osdKind: 'channel',
  infoOpen: false,
  submitOpen: false,
  guideOpen: false,
  deepLink: null,
  setPhase: (phase) => set({ phase }),
  setChannels: (channels) => {
    const s = get()
    const current = s.dial[s.index]
    const dial = buildDial(channels, s.pending)
    const keep = dial.findIndex((d) => d.number === current?.number)
    set({ channels, channelsLoaded: true, dial, index: keep >= 0 ? keep : Math.min(s.index, dial.length - 1) })
  },
  setPending: (pending) => {
    if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    else localStorage.removeItem(PENDING_KEY)
    const s = get()
    const dial = buildDial(s.channels, pending)
    set({ pending, dial, index: pending ? dial.length - 1 : Math.min(s.index, dial.length - 1) })
  },
  tune: (index) => {
    const n = get().dial.length
    set((s) => ({ index: ((index % n) + n) % n, osdNonce: s.osdNonce + 1, osdKind: 'channel', infoOpen: false }))
  },
  step: (delta) => get().tune(get().index + delta),
  tuneNumber: (n) => {
    const i = get().dial.findIndex((d) => d.number === n)
    if (i < 0) return false
    get().tune(i)
    return true
  },
  setVolume: (v) => {
    const volume = Math.max(0, Math.min(100, Math.round(v)))
    localStorage.setItem(VOLUME_KEY, String(volume))
    set((s) => ({ volume, muted: false, osdNonce: s.osdNonce + 1, osdKind: 'volume' }))
  },
  toggleMute: () => set((s) => ({ muted: !s.muted, osdNonce: s.osdNonce + 1, osdKind: 'volume' })),
  setInfoOpen: (infoOpen) => set({ infoOpen }),
  setSubmitOpen: (submitOpen) => set({ submitOpen }),
  setGuideOpen: (guideOpen) => set({ guideOpen }),
}))

export const currentSlot = () => {
  const s = useTv.getState()
  return s.dial[s.index]
}
