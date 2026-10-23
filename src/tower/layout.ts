import type { Slot } from '@/tv/store'

/** Building dimensions in scene units (≈ metres). The front faces +z. */
export const LOBBY_H = 7
export const FLOOR_H = 4.2
export const WIDTH = 16
export const DEPTH = 12
/** Never shorter than the ten "golden years" 2026–2035, however few stages are live. */
export const MIN_FLOORS = 10

export const floorY = (i: number) => LOBBY_H + (i + 0.5) * FLOOR_H
export const roofY = (floors: number) => LOBBY_H + floors * FLOOR_H

/**
 * One storey. Floors below the dial length are the TV dial (live, the visitor's pending stage, the
 * empty slot); the rest are "coming soon" storeys that keep the tower at least ten floors tall.
 */
export type Floor = { index: number; number: number } & ({ kind: 'slot'; slot: Slot } | { kind: 'future' })

export function floorsFor(dial: Slot[]): Floor[] {
  const total = Math.max(MIN_FLOORS, dial.length + 2)
  const last = dial[dial.length - 1]?.number ?? 2025
  return Array.from({ length: total }, (_, i) =>
    i < dial.length ? { index: i, number: dial[i].number, kind: 'slot', slot: dial[i] } : { index: i, number: last + (i - dial.length + 1), kind: 'future' },
  )
}

export function floorTitle(f: Floor) {
  if (f.kind === 'future') return '即將開放'
  if (f.slot.kind === 'empty') return '招租中・這層可以是你的'
  return f.slot.channel.title
}
