import { youtubeEmbedUrl, youtubeId, youtubeVolumeCommands } from './youtube'

const BASE = import.meta.env.BASE_URL

const pathMatch = (pathname: string) => {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '')
  return rest.match(/^(\d{4,5})(\/info)?\/?$/)
}

/** The channel number in /2027/ or /2027/info/ (relative to the deploy base), if any. */
export function channelFromPath(pathname = location.pathname): number | null {
  const m = pathMatch(pathname)
  return m ? Number(m[1]) : null
}

/** /2027/info/ opens that channel with its info sidebar already out. */
export const infoFromPath = (pathname = location.pathname) => !!pathMatch(pathname)?.[2]

const pageMeta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null

/** A short link or retired number names the channel it opens (and that channel's id, in case it moved since the build). */
export function aliasFromPage(): { n: number; id: string | null } | null {
  const n = Number(pageMeta('encore:channel'))
  return n ? { n, id: pageMeta('encore:alias') } : null
}

/** The channel this page should open: a short link's target, or the number in the path. */
export const deepLinkFromPage = () => aliasFromPage()?.n ?? channelFromPath()

/** The submit page is built with the station but published at the site root (/submit/), next to /tower/. */
export const SUBMIT_PATH = `${BASE.replace(/beta\/$/, '')}submit/`

export function channelPath(n: number) {
  return `${BASE}${n}/`
}

export function channelUrl(n: number) {
  return new URL(channelPath(n), location.origin).toString()
}

export const channelInfoUrl = (n: number) => new URL(`${channelPath(n)}info/`, location.origin).toString()

/** Resolve a channel's stored URL; built-in stages are stored relative to the site root. */
export function stageUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${BASE}${url.replace(/^\//, '')}`
}

/** What a screen's iframe loads: the stage itself, or the embedded player for a YouTube link. */
export function stageFrameUrl(url: string) {
  const yt = youtubeId(url)
  return yt ? youtubeEmbedUrl(yt) : stageUrl(url)
}

/** Send the TV volume to a stage frame, in the stage protocol and, for YouTube, as player commands. */
export function postStageVolume(win: Window | null | undefined, url: string, volume: number, muted: boolean) {
  if (!win) return
  win.postMessage({ type: 'encore:volume', volume, muted }, '*')
  if (youtubeId(url)) for (const cmd of youtubeVolumeCommands(volume, muted)) win.postMessage(cmd, '*')
}

/** The short link the page was opened on; once the visitor changes channel the address shows channel numbers. */
const aliasPath = location.pathname

export function syncUrl(n: number | null, title?: string, info = false) {
  const path = n == null ? BASE : `${channelPath(n)}${info ? 'info/' : ''}`
  const onAlias = !info && n != null && aliasFromPage()?.n === n && location.pathname === aliasPath
  if (location.pathname !== path && !onAlias) history.replaceState(null, '', path + location.search)
  document.title = title ?? '台北安可大舞台｜台北安可之夜・蔣萬安黃金十年政見 3D 互動派對'
}
