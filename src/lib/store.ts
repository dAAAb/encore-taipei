import { create } from 'zustand'
import platform from '@/data/platform.json'
import type { TroupeMode } from '@/scene/troupe-looks'

export type MusicMode = 'youtube' | 'synth' | 'off'
export type ViewMode = 'front' | 'close' | 'iso' | 'orbit'

export type PlatformItem = (typeof platform)[number]

interface ClubState {
  started: boolean
  musicMode: MusicMode
  /** The listener's choice; YouTube may not be ready yet when they pick it. */
  wantMusic: MusicMode
  youtubeReady: boolean
  youtubeFailed: boolean
  /** Autoplay with sound was blocked (Safari inside the TV frame); waiting for one tap on this page. */
  soundLocked: boolean
  view: ViewMode
  viewNonce: number
  speech: PlatformItem | null
  hype: number
  /** Backup dancers beside the mayor; the seed reshuffles who goes up and in what order. */
  troupeMode: TroupeMode
  troupeSeed: number
  /** The TV's remote carries the scene buttons (Duo layouts), so the on-screen ones step aside. */
  remoteControls: boolean
  start: () => void
  setMusicMode: (m: MusicMode) => void
  setWantMusic: (m: MusicMode) => void
  setYoutubeReady: (v: boolean) => void
  setYoutubeFailed: () => void
  setSoundLocked: (locked: boolean) => void
  setView: (v: ViewMode) => void
  setSpeech: (p: PlatformItem | null) => void
  bumpHype: (amount: number) => void
  nextTroupe: () => void
  setTroupe: (mode: TroupeMode) => void
  setRemoteControls: (v: boolean) => void
}

const TROUPE_CYCLE: TroupeMode[] = ['animals', 'citizens', 'mix']
const troupeParam = new URLSearchParams(location.search).get('troupe') as TroupeMode | null

export const useClub = create<ClubState>((set) => ({
  started: false,
  musicMode: 'youtube',
  wantMusic: 'youtube',
  youtubeReady: false,
  youtubeFailed: false,
  soundLocked: false,
  view: (new URLSearchParams(location.search).get('view') as ViewMode | null) ?? 'front',
  viewNonce: 0,
  speech: null,
  hype: 0,
  troupeMode: troupeParam && [...TROUPE_CYCLE, 'solo'].includes(troupeParam) ? troupeParam : 'solo',
  troupeSeed: troupeParam ? 1 + Math.floor(Math.random() * 10000) : 1,
  remoteControls: false,
  start: () => set({ started: true }),
  setMusicMode: (musicMode) => set({ musicMode }),
  setWantMusic: (wantMusic) => set({ wantMusic }),
  setYoutubeReady: (youtubeReady) => set({ youtubeReady }),
  setSoundLocked: (soundLocked) => set({ soundLocked }),
  setYoutubeFailed: () =>
    set((s) => ({
      youtubeFailed: true,
      musicMode: s.musicMode === 'youtube' ? 'synth' : s.musicMode,
    })),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  setSpeech: (speech) => set({ speech }),
  bumpHype: (amount) => set((s) => ({ hype: Math.min(1, s.hype + amount) })),
  nextTroupe: () =>
    set((s) => {
      const i = TROUPE_CYCLE.indexOf(s.troupeMode)
      return { troupeMode: TROUPE_CYCLE[(i + 1) % TROUPE_CYCLE.length], troupeSeed: s.troupeSeed + 1 + Math.floor(Math.random() * 1000) }
    }),
  setTroupe: (troupeMode) => set((s) => ({ troupeMode, troupeSeed: s.troupeSeed + 1 + Math.floor(Math.random() * 1000) })),
  setRemoteControls: (remoteControls) => set({ remoteControls }),
}))

/** Per-frame excitement level, read imperatively by the scene (no React re-render). */
export const hypeRef = { value: 0 }
