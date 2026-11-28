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

/** 2099 accent colours: white and blue, or the earlier yellow and blue with ?palette=yellow for comparison. */
export const ACCENT =
  new URLSearchParams(location.search).get('palette') === 'yellow'
    ? { light: '#ffd400', blue: '#2f6bff', sky: '#7fb2ff', stripe: '#ffd400', trim: '#e6c160', crown: '#e8c15a', city: '#f0cf73', facade: '0.98, 0.92, 0.76', ink: '#0c0812' }
    : { light: '#ffffff', blue: '#2f6bff', sky: '#8ec5ff', stripe: '#7fbcff', trim: '#cfd9e8', crown: '#dfe7f2', city: '#dbe7f7', facade: '0.86, 0.92, 1.0', ink: '#1f3f9e' }

export const seasonName = (s: Season) => (s === 'backrooms' ? '後室' : '台北 2099')
