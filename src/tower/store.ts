import { create } from 'zustand'

/**
 * gate      the tower at night behind a title card, waiting for the first tap (audio needs a gesture)
 * tower     flying the drone around the building
 * entering  the drone dives into a floor's window
 * floor     inside a floor: the stage itself, full screen
 * leaving   pulling back out of the window
 */
export type TowerMode = 'gate' | 'tower' | 'entering' | 'floor' | 'leaving'

interface TowerState {
  mode: TowerMode
  /** Where the drone is aiming, in floors (0 = first storey above the lobby, floors.length = roof). */
  target: number
  /** 0 = right up against the glass, 1 = far enough to see the whole tower. */
  zoom: number
  /** Orbit angle around the tower, radians. */
  yaw: number
  hover: number | null
  /** Dial index of the floor being entered or watched. */
  active: number
  /** Thin mist around the edges of a floor's stage. */
  mist: boolean
  /** Bumped by the controls; the rig snaps to the nearest floor once input settles. */
  nudge: number
  setMode: (m: TowerMode) => void
  setTarget: (t: number) => void
  setZoom: (z: number) => void
  setYaw: (y: number) => void
  setHover: (h: number | null) => void
  setActive: (i: number) => void
  setMist: (v: boolean) => void
}

export const useTower = create<TowerState>((set) => ({
  mode: 'gate',
  target: 0,
  zoom: 0.35,
  yaw: 0,
  hover: null,
  active: 0,
  mist: false,
  nudge: 0,
  setMode: (mode) => set({ mode }),
  setTarget: (target) => set((s) => ({ target, nudge: s.nudge + 1 })),
  setZoom: (zoom) => set({ zoom: Math.max(0, Math.min(1, zoom)) }),
  setYaw: (yaw) => set({ yaw: Math.max(-0.75, Math.min(0.75, yaw)) }),
  setHover: (hover) => set({ hover }),
  setActive: (active) => set({ active }),
  setMist: (mist) => set({ mist }),
}))
