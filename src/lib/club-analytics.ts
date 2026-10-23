import { initAnalytics, track } from './analytics'
import { useClub } from './store'

export function startClubAnalytics() {
  initAnalytics()
  useClub.subscribe((s, prev) => {
    if (s.started && !prev.started) track('club_enter')
    if (s.musicMode !== prev.musicMode) track('music_mode', { mode: s.musicMode })
    if (s.viewNonce !== prev.viewNonce) track('camera_view', { view: s.view })
  })
}
