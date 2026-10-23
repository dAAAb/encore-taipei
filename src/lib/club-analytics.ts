import { initAnalytics, track } from './analytics'
import { useClub } from './store'

/** The club reports its own page view only when opened directly; inside the TV it just sends events. */
export function startClubAnalytics() {
  const embedded = window.self !== window.top
  initAnalytics({ pageView: !embedded })
  const where = { embedded, troupe_channel: new URLSearchParams(location.search).has('troupe') }

  useClub.subscribe((s, prev) => {
    if (s.started && !prev.started && !embedded) track('club_enter', where)
    if (s.troupeSeed !== prev.troupeSeed || s.troupeMode !== prev.troupeMode) track('troupe_switch', { ...where, mode: s.troupeMode })
    if (s.musicMode !== prev.musicMode) track('music_mode', { ...where, mode: s.musicMode })
    if (s.viewNonce !== prev.viewNonce) track('camera_view', { ...where, view: s.view })
    if (!s.soundLocked && prev.soundLocked) track('sound_unlock', where)
  })
}
