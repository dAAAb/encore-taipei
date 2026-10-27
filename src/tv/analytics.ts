import { initAnalytics, track, trackPage } from '@/lib/analytics'
import { channelPath } from './routing'
import { useTv } from './store'

/** Station analytics: one virtual page view per channel watched, plus the big moments of the show. */
export function startTvAnalytics() {
  initAnalytics({ pageView: false })
  trackPage(location.pathname, document.title)

  useTv.subscribe((s, prev) => {
    if (s.phase !== prev.phase) {
      if (prev.phase === 'gate' && (s.phase === 'intro' || s.phase === 'tv')) track('tv_power_on')
      else if (prev.phase === 'intro' && s.phase === 'tv') track('intro_complete')
      else if (s.phase === 'off') track('tv_power_off')
      else if (prev.phase === 'off' && s.phase === 'gate') track('finale_complete')
    }

    const slot = s.dial[s.index]
    const moved = s.index !== prev.index || s.dial[s.index]?.number !== prev.dial[prev.index]?.number || (s.phase === 'tv' && prev.phase !== 'tv')
    if (s.phase === 'tv' && slot && moved) {
      const title = slot.kind === 'empty' ? '訊號徵求中' : slot.channel.title
      trackPage(channelPath(slot.number), `第 ${slot.number} 台｜${title}｜台北安可電視台`)
      track('channel_view', { channel_number: slot.number, channel_title: title, channel_kind: slot.kind })
    }

    if (s.guideOpen && !prev.guideOpen) track('guide_open')
    if (s.submitOpen && !prev.submitOpen) track('submit_open', { channel_number: slot?.number })
    if (s.infoOpen && !prev.infoOpen) track('channel_info_open', { channel_number: slot?.number })
    if (s.pending && s.pending !== prev.pending) track('stage_submit')
  })
}
