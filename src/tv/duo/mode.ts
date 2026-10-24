/**
 * Duo modes, switched on by a bare flag in the address:
 *   ?duo     one tall screen split in two: the TV on top, a full-width remote below (iPhone Duo held upright)
 *   ?tv      this device is only the TV; a second phone pairs with it as the remote
 *   ?remote  this device is only the remote for a paired TV
 * The first links, ?duo=true / ?duo=tv / ?duo=remote, keep working. When several are given the
 * remote wins, then the TV, then the split screen. Keys and values are case-insensitive, and a flag
 * set to false / 0 / off / no is off.
 */
export type DuoMode = 'split' | 'tv' | 'remote'

const OFF = new Set(['false', '0', 'off', 'no'])

export function readDuoMode(search = location.search): DuoMode | null {
  const flags = new Map<string, string>()
  for (const [k, v] of new URLSearchParams(search)) {
    const key = k.trim().toLowerCase()
    if (!flags.has(key)) flags.set(key, v.trim().toLowerCase())
  }
  const on = (key: string) => flags.has(key) && !OFF.has(flags.get(key)!)
  const duo = flags.get('duo')
  if (on('remote') || duo === 'remote' || duo === 'bottom') return 'remote'
  if (on('tv') || duo === 'tv' || duo === 'top') return 'tv'
  if (on('duo')) return 'split'
  return null
}

export const DUO_MODE = readDuoMode()

const ROOM_RE = /^[A-Za-z0-9]{16,40}$/
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const isRoom = (r: unknown): r is string => typeof r === 'string' && ROOM_RE.test(r)

export function newRoom() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function stored(key: string) {
  try {
    const v = sessionStorage.getItem(key)
    return isRoom(v) ? v : null
  } catch {
    return null
  }
}

function store(key: string, room: string | null) {
  try {
    if (room) sessionStorage.setItem(key, room)
    else sessionStorage.removeItem(key)
  } catch {
    /* private mode: the room only lives as long as the page */
  }
}

const TV_KEY = 'encore.duo.tv'
const REMOTE_KEY = 'encore.duo.remote'

/** The TV keeps one room per tab, so a reload does not strand the paired remote. It never goes in the URL. */
export function tvRoom() {
  const room = stored(TV_KEY) ?? newRoom()
  store(TV_KEY, room)
  return room
}

/** The remote takes its room from the QR link once, then drops it from the address bar so it is not shared by accident. */
export function takeRemoteRoom() {
  const fromUrl = new URLSearchParams(location.search).get('room')
  if (fromUrl !== null) {
    // Rebuilt from the raw pieces so bare flags stay bare (?remote, not ?remote=).
    const qs = location.search
      .replace(/^\?/, '')
      .split('&')
      .filter((part) => part && part.split('=')[0].toLowerCase() !== 'room')
      .join('&')
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''))
    if (isRoom(fromUrl)) {
      store(REMOTE_KEY, fromUrl)
      return { room: fromUrl, viaLink: true }
    }
  }
  return { room: stored(REMOTE_KEY), viaLink: false }
}

export const saveRemoteRoom = (room: string | null) => store(REMOTE_KEY, room)

export function remoteLink(room: string) {
  return `${location.origin}${import.meta.env.BASE_URL}?remote&room=${room}`
}
