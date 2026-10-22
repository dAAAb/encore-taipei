/** Official 「台北安可｜2026蔣萬安連任競選主題曲」 on 蔣萬安's YouTube channel. */
export const TAIPEI_ENCORE_VIDEO_ID = 'uKCiYJdv6Zg'
export const TAIPEI_ENCORE_URL = `https://www.youtube.com/watch?v=${TAIPEI_ENCORE_VIDEO_ID}`

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  mute(): void
  unMute(): void
  setVolume(v: number): void
  seekTo(s: number, allowSeekAhead: boolean): void
  getPlayerState(): number
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onError?: (e: { data: number }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(timeoutMs = 12000): Promise<YTNamespace> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT)
    const timer = window.setTimeout(() => reject(new Error('YouTube API timeout')), timeoutMs)
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer)
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('YouTube API blocked'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}
