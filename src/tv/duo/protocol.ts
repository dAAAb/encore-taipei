/**
 * What the paired phones say to each other. Everything that arrives over the wire is untrusted:
 * it is parsed into these shapes or dropped.
 */
export type ViewMode = 'front' | 'close' | 'iso' | 'orbit'
export type MusicMode = 'youtube' | 'synth' | 'off'
export type Color = 'red' | 'green' | 'yellow' | 'blue'

/** 體感安可 from a phone remote: a confetti burst, a shake gust, or which way the phone is tilted (screen axes, ±1.5). */
export type EncoreCommand = { a: 'encore'; t: 'burst' | 'gust' | 'tilt'; x: number; y: number }

export type StageCommand = { a: 'view'; v: ViewMode } | { a: 'music'; v: MusicMode } | { a: 'troupe'; v: 'next' | 'solo' } | EncoreCommand

export type Command =
  | { k: 'step'; d: 1 | -1 }
  | { k: 'tune'; n: number }
  | { k: 'digit'; d: number }
  | { k: 'vol'; d: 5 | -5 }
  | { k: 'mute' }
  | { k: 'info' }
  | { k: 'power' }
  | { k: 'color'; c: Color }
  | ({ k: 'stage' } & StageCommand)

/** What a built-in stage reports back so the remote can light up the right buttons. */
export interface StageState {
  view: ViewMode
  music: MusicMode
  troupe: 'solo' | 'animals' | 'citizens' | 'mix'
  ytFailed: boolean
}

export interface DialEntry {
  n: number
  t: string
  k: 'live' | 'pending' | 'empty'
}

export type TvPhase = 'gate' | 'intro' | 'tv' | 'off'

/** The TV's state as the remote shows it. */
export interface TvSnapshot {
  phase: TvPhase
  n: number | null
  title: string
  author: string
  kind: DialEntry['k'] | null
  volume: number
  muted: boolean
  entry: string
  dial: DialEntry[]
  stage: StageState | null
}

const VIEWS: ViewMode[] = ['front', 'close', 'iso', 'orbit']
const MUSIC: MusicMode[] = ['youtube', 'synth', 'off']
const COLORS: Color[] = ['red', 'green', 'yellow', 'blue']
const TROUPES: StageState['troupe'][] = ['solo', 'animals', 'citizens', 'mix']
const PHASES: TvPhase[] = ['gate', 'intro', 'tv', 'off']
const KINDS: DialEntry['k'][] = ['live', 'pending', 'empty']

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null)
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const channelNumber = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 99999
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function parseCommand(x: unknown): Command | null {
  const o = obj(x)
  if (!o) return null
  switch (o.k) {
    case 'step':
      return o.d === 1 || o.d === -1 ? { k: 'step', d: o.d } : null
    case 'tune':
      return channelNumber(o.n) ? { k: 'tune', n: o.n } : null
    case 'digit':
      return Number.isInteger(o.d) && (o.d as number) >= 0 && (o.d as number) <= 9 ? { k: 'digit', d: o.d as number } : null
    case 'vol':
      return o.d === 5 || o.d === -5 ? { k: 'vol', d: o.d } : null
    case 'mute':
    case 'info':
    case 'power':
      return { k: o.k }
    case 'color':
      return oneOf(COLORS, o.c) ? { k: 'color', c: o.c } : null
    case 'stage': {
      const s = parseStageCommand(o)
      return s ? { k: 'stage', ...s } : null
    }
    default:
      return null
  }
}

export function parseStageCommand(x: unknown): StageCommand | null {
  const o = obj(x)
  if (!o) return null
  if (o.a === 'view' && oneOf(VIEWS, o.v)) return { a: 'view', v: o.v }
  if (o.a === 'music' && oneOf(MUSIC, o.v)) return { a: 'music', v: o.v }
  if (o.a === 'troupe' && (o.v === 'next' || o.v === 'solo')) return { a: 'troupe', v: o.v }
  if (o.a === 'encore' && (o.t === 'burst' || o.t === 'gust' || o.t === 'tilt')) return { a: 'encore', t: o.t, x: axis(o.x), y: axis(o.y) }
  return null
}

const axis = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1.5, Math.min(1.5, Math.round(v * 100) / 100)) : 0)

export function parseStageState(x: unknown): StageState | null {
  const o = obj(x)
  if (!o || !oneOf(VIEWS, o.view) || !oneOf(MUSIC, o.music) || !oneOf(TROUPES, o.troupe)) return null
  return { view: o.view, music: o.music, troupe: o.troupe, ytFailed: o.ytFailed === true }
}

export function parseSnapshot(x: unknown): TvSnapshot | null {
  const o = obj(x)
  if (!o || !oneOf(PHASES, o.phase)) return null
  const dial: DialEntry[] = []
  if (Array.isArray(o.dial)) {
    for (const d of o.dial.slice(0, 80)) {
      const e = obj(d)
      if (e && channelNumber(e.n) && oneOf(KINDS, e.k)) dial.push({ n: e.n, t: text(e.t, 80), k: e.k })
    }
  }
  return {
    phase: o.phase,
    n: channelNumber(o.n) ? o.n : null,
    title: text(o.title, 80),
    author: text(o.author, 60),
    kind: oneOf(KINDS, o.kind) ? o.kind : null,
    volume: typeof o.volume === 'number' && Number.isFinite(o.volume) ? Math.max(0, Math.min(100, Math.round(o.volume))) : 70,
    muted: o.muted === true,
    entry: typeof o.entry === 'string' && /^[0-9]{0,5}$/.test(o.entry) ? o.entry : '',
    dial,
    stage: o.stage == null ? null : parseStageState(o.stage),
  }
}

/** A sender id is only used to tell remotes apart; it is never shown. */
export const isPeerId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{6,16}$/.test(v)
