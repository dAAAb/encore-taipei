/** The tower lives at /beta/tower/ and is also copied to /tower/ at the site root; work out which. */
const match = location.pathname.match(/^(.*?\/tower)(?:\/(\d{4,5}))?\/?(?:index\.html)?$/)

export const TOWER_ROOT = `${match?.[1] ?? `${import.meta.env.BASE_URL}tower`}/`

export function floorFromPath(): number | null {
  return match?.[2] ? Number(match[2]) : null
}

export function floorPath(n: number | null) {
  return n == null ? TOWER_ROOT : `${TOWER_ROOT}${n}/`
}

export function syncTowerUrl(n: number | null, title: string, push = false) {
  const path = floorPath(n)
  if (location.pathname !== path) {
    if (push) history.pushState({ floor: n }, '', path + location.search)
    else history.replaceState({ floor: n }, '', path + location.search)
  }
  document.title = title
}
