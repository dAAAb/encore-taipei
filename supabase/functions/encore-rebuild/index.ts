// Admin-only: asks GitHub Actions to rebuild the site so new channels get their share pages and
// screenshots right away. Needs a fine-grained GitHub token (Actions: write) saved from the admin page.

const REPO = 'dAAAb/encore-taipei'
const WORKFLOW = 'deploy-pages.yml'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = (path: string, init?: RequestInit) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { key } = (await req.json().catch(() => ({}))) as { key?: string }
  if (!key) return json({ error: 'forbidden' }, 403)

  const isAdmin = await db('rpc/encore_is_admin', { method: 'POST', body: JSON.stringify({ p_key: key }) }).then((r) => r.json())
  if (isAdmin !== true) return json({ error: 'forbidden' }, 403)

  const rows = (await db('encore_settings?name=eq.github_token&select=value').then((r) => r.json())) as { value: string }[]
  const token = rows?.[0]?.value
  if (!token) return json({ error: 'not_configured' }, 409)

  const gh = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'encore-taipei-admin',
    },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (gh.status === 204) return json({ ok: true })
  const detail = await gh.text()
  return json({ error: 'github', status: gh.status, message: detail.slice(0, 200) }, 502)
})
