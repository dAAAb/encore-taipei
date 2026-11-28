import { create } from 'zustand'
import { rpc } from '@/tv/channel-data'

/**
 * The look of the TV room and the tower. Admins switch it from the admin page (it lives in encore_settings), so a
 * season can be rolled back without a deploy; ?season=backrooms or ?season=2099 overrides it for one visit.
 */
export type Season = '2099' | 'backrooms'
export type RoofChat = 'open' | 'closed'

const DEFAULT_SEASON: Season = '2099'
const CACHE_KEY = 'encore.siteSettings'

interface Settings {
  season: Season
  roofChat: RoofChat
}

const isSeason = (v: unknown): v is Season => v === '2099' || v === 'backrooms'
const forced = (() => {
  const v = new URLSearchParams(location.search).get('season')
  return isSeason(v) ? v : null
})()

function cached(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Partial<Settings>
    return {
      season: isSeason(raw.season) ? raw.season : DEFAULT_SEASON,
      roofChat: raw.roofChat === 'closed' ? 'closed' : 'open',
    }
  } catch {
    return { season: DEFAULT_SEASON, roofChat: 'open' }
  }
}

const initial = cached()

export const useSite = create<Settings>(() => ({ ...initial, season: forced ?? initial.season }))

let loading: Promise<void> | null = null

/** Fetches the switches once per page; until then the last known values (or the defaults) apply. */
export function loadSiteSettings() {
  loading ??= rpc<{ season?: string; roof_chat?: string }>('encore_public_settings', {}, AbortSignal.timeout(6000))
    .then((r) => {
      const next: Settings = {
        season: isSeason(r?.season) ? r.season : DEFAULT_SEASON,
        roofChat: r?.roof_chat === 'closed' ? 'closed' : 'open',
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      useSite.setState({ ...next, season: forced ?? next.season })
    })
    .catch(() => {})
  return loading
}

export const seasonName = (s: Season) => (s === 'backrooms' ? '後室' : '台北 2099')
