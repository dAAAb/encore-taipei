const BASE = import.meta.env.BASE_URL

/** The channel number in /2027/ (relative to the deploy base), if any. */
export function channelFromPath(pathname = location.pathname): number | null {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '')
  const m = rest.match(/^(\d{4,5})\/?$/)
  return m ? Number(m[1]) : null
}

export function channelPath(n: number) {
  return `${BASE}${n}/`
}

export function channelUrl(n: number) {
  return new URL(channelPath(n), location.origin).toString()
}

/** Resolve a channel's stored URL; built-in stages are stored relative to the site root. */
export function stageUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${BASE}${url.replace(/^\//, '')}`
}

export function syncUrl(n: number | null, title?: string) {
  const path = n == null ? BASE : channelPath(n)
  if (location.pathname !== path) history.replaceState(null, '', path + location.search)
  document.title = title ?? '台北安可電視台 ENCORE.TAIPEI｜轉台看每個人做的台北安可舞台'
}
