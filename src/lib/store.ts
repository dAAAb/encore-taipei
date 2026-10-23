import { create } from 'zustand'
import platform from '@/data/platform.json'

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
  /** Autoplay with sound was blocked; waiting for one more tap on the page. */
  soundLocked: boolean
  view: ViewMode
  viewNonce: number
  speech: PlatformItem | null
  hype: number
  start: () => void
  setMusicMode: (m: MusicMode) => void
  setWantMusic: (m: MusicMode) => void
  setYoutubeReady: (v: boolean) => void
  setSoundLocked: (locked: boolean) => void
  setYoutubeFailed: () => void
  setView: (v: ViewMode) => void
  setSpeech: (p: PlatformItem | null) => void
  bumpHype: (amount: number) => void
}

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
}))

/** Per-frame excitement level, read imperatively by the scene (no React re-render). */
export const hypeRef = { value: 0 }
