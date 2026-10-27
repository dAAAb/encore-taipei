/** YouTube channels: a watch / Shorts / youtu.be link plays in the embedded player. DOM-free (the build uses it too). */

const HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i
const ID = /^[\w-]{11}$/

export function youtubeId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!HOSTS.test(u.hostname)) return null
  const id = /youtu\.be$/i.test(u.hostname)
    ? u.pathname.split('/')[1]
    : (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1])
  return id && ID.test(id) ? id : null
}

/** Full-frame player that starts on its own and loops; enablejsapi lets the TV set its volume. */
export const youtubeEmbedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&loop=1&playlist=${id}&rel=0&enablejsapi=1`

export const youtubeThumbnails = (id: string) => [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`]

/** IFrame API commands mirroring the TV volume; the player ignores the stage protocol's encore:volume. */
export const youtubeVolumeCommands = (volume: number, muted: boolean) => [
  JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(Math.max(0, Math.min(1, volume)) * 100)] }),
  JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }),
]
