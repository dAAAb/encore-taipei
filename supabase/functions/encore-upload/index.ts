// Hosts a one-file HTML stage (a Gemini Canvas or Claude artifact export, say) on IPFS through the site's Pinata
// account, for stages whose own host refuses to be framed. Anyone may upload, rate limited per visitor; the admin page
// saves the Pinata key and gateway, tests them, and unpins a deleted channel's upload.
//
//   GET                                   → { enabled }
//   POST multipart `file`                 → { url, cid, title, description }
//   POST { action: 'test', key }          → { ok, checks }   admin: probe upload served through the gateway
//   POST { action: 'unpin', key, url }    → { ok }           admin: unpin if no channel still uses it

const MAX_BYTES = 5 * 1024 * 1024
const PINATA = 'https://api.pinata.cloud'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = (path: string, init?: RequestInit) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...init?.headers },
  })
const call = async <T>(fn: string, body: Record<string, unknown>) => {
  const res = await db(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data as { message?: string } | null)?.message ?? `rpc ${fn} ${res.status}`)
  return data as T
}

async function settings() {
  const rows = (await db('encore_settings?name=in.(pinata_jwt,pinata_gateway)&select=name,value').then((r) => r.json())) as { name: string; value: string }[]
  const get = (n: string) => rows?.find((r) => r.name === n)?.value ?? null
  const gateway = get('pinata_gateway')
    ?.replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
  return { jwt: get('pinata_jwt'), gateway: gateway && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(gateway) ? gateway : null }
}

const isAdmin = (key: unknown) =>
  typeof key === 'string' && key.length > 0
    ? call<boolean>('encore_is_admin', { p_key: key }).catch(() => false)
    : Promise.resolve(false)

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Pinned as `stage/index.html` so the gateway serves a folder: the URL ends in `/` and the page gets text/html. */
async function pin(jwt: string, bytes: Uint8Array, name: string) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'text/html' }), 'stage/index.html')
  form.append('pinataMetadata', JSON.stringify({ name: name.slice(0, 100), keyvalues: { source: 'encore-submit' } }))
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
  const res = await fetch(`${PINATA}/pinning/pinFileToIPFS`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form })
  const data = (await res.json().catch(() => null)) as { IpfsHash?: string; error?: unknown } | null
  if (!res.ok || !data?.IpfsHash) throw Object.assign(new Error('pinata'), { status: res.status, detail: JSON.stringify(data?.error ?? data).slice(0, 200) })
  return data.IpfsHash
}

const unpin = (jwt: string, cid: string) =>
  fetch(`${PINATA}/pinning/unpin/${encodeURIComponent(cid)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } }).then((r) => r.ok || r.status === 404)

const markUnpinned = (cid: string) => db(`encore_uploads?cid=eq.${encodeURIComponent(cid)}`, { method: 'PATCH', body: JSON.stringify({ unpinned_at: new Date().toISOString() }) })

async function sweep(jwt: string) {
  const stale = await call<{ cid: string }[]>('encore_upload_stale', { p_limit: 5 }).catch(() => [])
  for (const { cid } of stale) if (await unpin(jwt, cid)) await markUnpinned(cid)
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

/** Response headers that would keep the stage out of the TV's iframe, or break the inline scripts AI-made pages rely on. */
function framingProblems(h: Headers) {
  const problems: string[] = []
  const xfo = h.get('x-frame-options')?.toLowerCase()
  if (xfo && /deny|sameorigin/.test(xfo)) problems.push(`x-frame-options: ${xfo}`)
  const csp = (h.get('content-security-policy') ?? '').toLowerCase()
  const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
  const ancestors = directive('frame-ancestors')
  if (ancestors && !/\*|encore\.taipei/.test(ancestors)) problems.push(ancestors)
  const scripts = directive('script-src') ?? directive('default-src')
  if (scripts && !scripts.includes("'unsafe-inline'")) problems.push(scripts)
  return problems
}

async function upload(req: Request) {
  const { jwt, gateway } = await settings()
  if (!jwt || !gateway) return json({ error: 'not_configured' }, 409)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return json({ error: 'no_file' }, 400)
  if (file.size > MAX_BYTES) return json({ error: 'too_large', max: MAX_BYTES }, 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!bytes.length) return json({ error: 'no_file' }, 400)
  const html = new TextDecoder().decode(bytes)
  if (!/<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]/i.test(html.slice(0, 200_000))) return json({ error: 'not_html' }, 415)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
  const ipHash = await sha256(`${SERVICE.slice(-16)}:${ip}`)
  let slot: string
  try {
    slot = await call<string>('encore_upload_begin', { p_ip_hash: ipHash, p_bytes: bytes.length, p_name: file.name || 'stage.html' })
  } catch (e) {
    return (e as Error).message.includes('rate_limited') ? json({ error: 'rate_limited' }, 429) : json({ error: 'failed' }, 500)
  }

  let cid: string
  try {
    cid = await pin(jwt, bytes, `encore ${new Date().toISOString().slice(0, 16)} ${file.name || 'stage.html'}`)
  } catch (e) {
    await db(`encore_uploads?id=eq.${slot}`, { method: 'DELETE' })
    const status = (e as { status?: number }).status
    return json({ error: status === 401 || status === 403 ? 'pinata_auth' : 'pinata', status }, 502)
  }
  await db(`encore_uploads?id=eq.${slot}`, { method: 'PATCH', body: JSON.stringify({ cid }) })
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime.
  globalThis.EdgeRuntime?.waitUntil?.(sweep(jwt))

  const head = html.slice(0, 200_000)
  const title = meta(head, 'og:title') ?? (head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null)
  return json({
    url: `https://${gateway}/ipfs/${cid}/`,
    cid,
    title: title?.slice(0, 120) || null,
    description: (meta(head, 'og:description') ?? meta(head, 'description'))?.slice(0, 300) || null,
  })
}

async function test() {
  const { jwt, gateway } = await settings()
  if (!jwt || !gateway) return json({ error: 'not_configured' }, 409)
  const token = crypto.randomUUID()
  const probe = `<!doctype html><html><head><meta charset="utf-8"><title>encore probe</title></head><body><script>document.body.dataset.ok='1'</script>${token}</body></html>`
  let cid: string
  try {
    cid = await pin(jwt, new TextEncoder().encode(probe), `encore gateway test ${token.slice(0, 8)}`)
  } catch (e) {
    const status = (e as { status?: number }).status
    return json({ ok: false, error: status === 401 || status === 403 ? 'pinata_auth' : 'pinata', status, detail: (e as { detail?: string }).detail })
  }
  const url = `https://${gateway}/ipfs/${cid}/`
  const checks: { name: string; ok: boolean; detail?: string }[] = [{ name: 'pin', ok: true, detail: cid }]
  try {
    let res: Response | null = null
    // A fresh pin can take a few seconds to show up on the gateway.
    for (let i = 0; i < 4; i++) {
      res = await fetch(url, { signal: AbortSignal.timeout(12000) })
      if (res.ok) break
      await res.body?.cancel()
      await new Promise((r) => setTimeout(r, 1500))
    }
    const body = res?.ok ? await res.text() : ''
    checks.push({ name: 'reachable', ok: !!res?.ok && body.includes(token), detail: res ? `HTTP ${res.status}` : 'no response' })
    const type = res?.headers.get('content-type') ?? ''
    checks.push({ name: 'html', ok: type.includes('text/html'), detail: type || 'none' })
    const problems = res ? framingProblems(res.headers) : ['no response']
    checks.push({ name: 'frame', ok: problems.length === 0, detail: problems.join(' | ') || undefined })
  } catch (e) {
    checks.push({ name: 'reachable', ok: false, detail: (e as Error).message })
  }
  await unpin(jwt, cid)
  return json({ ok: checks.every((c) => c.ok), url, checks })
}

async function remove(url: unknown) {
  const { jwt } = await settings()
  if (!jwt) return json({ error: 'not_configured' }, 409)
  const cid = typeof url === 'string' ? url.match(/\/ipfs\/([a-z0-9]+)/i)?.[1] : null
  if (!cid) return json({ ok: false, error: 'not_ipfs' })
  if (!(await call<boolean>('encore_upload_orphan', { p_cid: cid }).catch(() => false))) return json({ ok: false, error: 'in_use_or_unknown' })
  if (!(await unpin(jwt, cid))) return json({ ok: false, error: 'pinata' }, 502)
  await markUnpinned(cid)
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    if (req.method === 'GET') {
      const { jwt, gateway } = await settings()
      return json({ enabled: !!(jwt && gateway) })
    }
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) return await upload(req)
    const body = (await req.json().catch(() => ({}))) as { action?: string; key?: string; url?: string }
    if (!(await isAdmin(body.key))) return json({ error: 'forbidden' }, 403)
    if (body.action === 'test') return await test()
    if (body.action === 'unpin') return await remove(body.url)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: 'failed', message: (e as Error).message }, 500)
  }
})
