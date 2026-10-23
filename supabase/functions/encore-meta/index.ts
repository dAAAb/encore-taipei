// Reads a submitted stage's <title>, og:title, og:description and og:image so the submit form can
// prefill the channel name. Public and read-only: https only, no IP or local hosts, 6 s, first 512 KB.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  })

function allowed(u: URL) {
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return false
  return true
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

function meta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (name !== key) continue
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1]
    if (content) return decode(content)
  }
  return null
}

async function readHead(res: Response, limit = 512 * 1024) {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < limit) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
    if (new TextDecoder().decode(value).includes('</head>')) break
  }
  reader.cancel().catch(() => {})
  const all = new Uint8Array(size)
  let o = 0
  for (const c of chunks) {
    all.set(c, o)
    o += c.length
  }
  return new TextDecoder().decode(all)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const raw = new URL(req.url).searchParams.get('url') ?? ''
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return json({ error: 'invalid_url' }, 400)
  }
  if (!allowed(target)) return json({ error: 'invalid_url' }, 400)

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'EncoreTaipeiBot/1.0 (+https://encore.taipei)', Accept: 'text/html,application/xhtml+xml' },
    })
    if (!allowed(new URL(res.url))) return json({ error: 'invalid_url' }, 400)
    if (!res.ok) return json({ error: 'unreachable', status: res.status }, 502)
    const html = await readHead(res)
    const title = meta(html, 'og:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null)
    const image = meta(html, 'og:image') ?? meta(html, 'twitter:image')
    let imageUrl: string | null = null
    if (image) {
      try {
        const u = new URL(image, res.url)
        if (u.protocol === 'https:') imageUrl = u.toString()
      } catch {
        imageUrl = null
      }
    }
    return json({
      url: res.url,
      title: title?.slice(0, 120) || null,
      description: (meta(html, 'og:description') ?? meta(html, 'description'))?.slice(0, 300) || null,
      image: imageUrl,
    })
  } catch {
    return json({ error: 'unreachable' }, 502)
  }
})
