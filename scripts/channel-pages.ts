import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { FALLBACK_CHANNELS, fetchLiveChannels, FIRST_CHANNEL, type Channel } from '../src/tv/channel-data.ts'
import { youtubeId, youtubeThumbnails } from '../src/tv/youtube.ts'

/** Empty "signal wanted" channels pre-rendered past the last live one, so fresh share links still unfurl. */
const SPARE_CHANNELS = 16
const FONTS = ['og-black.ttf', 'og-medium.ttf'].map((f) => path.resolve(import.meta.dirname, 'assets', f))

/** Screenshots are reused from the live site until the stage's URL or title changes, or they get this old. */
const SHOT_MAX_AGE_DAYS = 7
/** Bump to re-shoot every channel once (e.g. after changing how shots are taken). */
const SHOT_VERSION = 3
/** YouTube channels get their own key, so a screenshot taken of the YouTube page before they were embedded is retaken. */
const shotKey = (ch: Channel) => `${SHOT_VERSION}|${youtubeId(ch.url) ? 'youtube|' : ''}${ch.url}|${ch.title}`
/** Hand-made share images for the built-in stages, keyed by stage URL so renumbering channels can't mix them up. */
const HANDMADE: Record<string, string> = { 'club/': 'stage-club.jpg', 'club/?troupe=animals': 'stage-troupe.jpg' }
const CHROME_PATHS = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/local/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']

interface ShotEntry {
  key: string
  at: string
  /** `stage`: a screenshot of the stage itself; `preview`: its own og:image or GitHub preview, because the shot came out blank. */
  from?: 'stage' | 'preview'
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function setMeta(html: string, m: { title: string; description: string; image: string; url: string }) {
  const attr = (re: RegExp, value: string) => {
    html = html.replace(re, (_all, pre: string) => `${pre}${esc(value)}"`)
  }
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
  attr(/(<meta\s+name="description"\s+content=")[^"]*"/, m.description)
  attr(/(<meta\s+property="og:title"\s+content=")[^"]*"/, m.title)
  attr(/(<meta\s+property="og:description"\s+content=")[^"]*"/, m.description)
  attr(/(<meta\s+property="og:image"\s+content=")[^"]*"/, m.image)
  attr(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, m.title)
  attr(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, m.description)
  attr(/(<meta\s+name="twitter:image"\s+content=")[^"]*"/, m.image)
  if (/property="og:url"/.test(html)) attr(/(<meta\s+property="og:url"\s+content=")[^"]*"/, m.url)
  else html = html.replace('</head>', `  <meta property="og:url" content="${esc(m.url)}" />\n  </head>`)
  if (/rel="canonical"/.test(html)) html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*"/, `$1${esc(m.url)}"`)
  else html = html.replace('</head>', `  <link rel="canonical" href="${esc(m.url)}" />\n  </head>`)
  return html
}

const SCANLINES = `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" fill-opacity="0.12"/></pattern>`
const GLOW = `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

function frame(inner: string, screen = '#0b1020') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${SCANLINES}${GLOW}
    <radialGradient id="room" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3a3115"/><stop offset="1" stop-color="#0b0906"/></radialGradient>
    <radialGradient id="tube" cx="50%" cy="50%" r="72%"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#room)"/>
  <rect x="70" y="40" width="1060" height="550" rx="34" fill="#15120d" stroke="#0c0812" stroke-width="6"/>
  <rect x="100" y="66" width="1000" height="498" rx="18" fill="${screen}"/>
  ${inner}
  <rect x="100" y="66" width="1000" height="498" rx="18" fill="url(#tube)"/>
  <rect x="100" y="66" width="1000" height="498" rx="18" fill="url(#scan)"/>
  <rect x="100" y="66" width="1000" height="498" rx="18" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="10"/>
  <circle cx="1100" cy="577" r="5" fill="#ff3b3b"/>
</svg>`
}

function channelCard(n: number, live: boolean) {
  const bars = BARS.map((c, i) => `<rect x="${100 + (i * 1000) / 7}" y="66" width="${1000 / 7 + 1}" height="330" fill="${c}"/>`).join('')
  const body = live
    ? `<text x="1050" y="190" text-anchor="end" font-family="Noto Sans TC" font-weight="900" font-size="150" fill="#b6ffb0" filter="url(#glow)">${n}</text>
       <text x="150" y="470" font-family="Noto Sans TC" font-weight="900" font-size="64" fill="#ffffff">台北安可大舞台</text>
       <text x="150" y="530" font-family="Noto Sans TC" font-weight="500" font-size="34" fill="#c9d3ff">ENCORE.TAIPEI · 第 ${n} 台 · 現正播放</text>`
    : `${bars}
       <rect x="100" y="396" width="1000" height="168" fill="#101010"/>
       <rect x="330" y="160" width="540" height="150" rx="12" fill="#000" fill-opacity="0.82"/>
       <text x="600" y="262" text-anchor="middle" font-family="Noto Sans TC" font-weight="900" font-size="84" fill="#ffffff">訊號徵求中</text>
       <text x="150" y="478" font-family="Noto Sans TC" font-weight="900" font-size="52" fill="#ffffff">第 ${n} 台 · 這一台還空著</text>
       <text x="150" y="532" font-family="Noto Sans TC" font-weight="500" font-size="30" fill="#c9d3ff">ENCORE.TAIPEI · 做一座你的台北安可舞台</text>`
  return frame(body, live ? '#16306b' : '#101010')
}

/** A still of the stage (or its preview image) in a 1200×630 frame with the TV's channel number and a station tag. */
function shotPage(src: string, n: number, title: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700;900&display=block">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #000; font-family: 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif; }
  img { position: absolute; inset: 0; width: 1200px; height: 630px; object-fit: cover; }
  .osd { position: absolute; top: 20px; right: 30px; font: 900 66px/1 ui-monospace, 'DejaVu Sans Mono', monospace; color: #b6ffb0;
    text-shadow: 0 0 14px rgba(90, 255, 130, 0.75), 3px 3px 0 #000; letter-spacing: 2px; }
  .tag { position: absolute; left: 24px; bottom: 22px; max-width: 1060px; display: flex; gap: 12px; align-items: center; padding: 9px 18px;
    border-radius: 999px; background: rgba(10, 8, 18, 0.84); border: 3px solid #ffd400; color: #fff; font-weight: 900; font-size: 27px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 4px 4px 0 #0c0812; }
  .tag b { color: #ffd400; }
</style></head><body>
<img src="${esc(src)}" alt="">
<div class="osd">${n}</div>
<div class="tag"><b>台北安可大舞台</b><span>第 ${n} 台・${esc(title)}</span></div>
</body></html>`
}

/**
 * `blank` when the still is (nearly) one flat colour: an error page, a site that refused to load, or a stage still black.
 */
const INSPECT_STILL = `(async () => {
  const img = document.querySelector('img')
  try {
    await img.decode()
  } catch {
    return 'error'
  }
  const c = document.createElement('canvas')
  c.width = 60
  c.height = 32
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0, c.width, c.height)
  let d
  try {
    d = g.getImageData(0, 0, c.width, c.height).data
  } catch {
    return 'ok'
  }
  let sum = 0
  let sq = 0
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    sum += l
    sq += l * l
  }
  const n = d.length / 4
  const mean = sum / n
  return Math.sqrt(Math.max(0, sq / n - mean * mean)) < 6 ? 'blank' : 'ok'
})()`

/** Download a preview image so the still check can measure it (canvases can't read cross-origin pixels). */
async function asDataUrl(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'encore.taipei share-image builder' } })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return null
    return `data:${type.split(';')[0]};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

/** GitHub's social preview for a repo link like https://github.com/owner/repo. */
function githubPreview(url: string | null) {
  const m = url?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[#?].*)?$/)
  return m ? `https://opengraph.githubassets.com/1/${m[1]}/${m[2]}` : null
}

async function stageOgImage(stage: string) {
  try {
    const html = await fetch(stage, { signal: AbortSignal.timeout(6000) }).then((r) => r.text())
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    if (!m) return null
    const u = new URL(m[1], stage)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function channelPages({ siteUrl, base }: { siteUrl: string; base: string }): Plugin {
  let config: ResolvedConfig
  return {
    name: 'channel-pages',
    apply: 'build',
    configResolved(c) {
      config = c
    },
    async closeBundle() {
      const out = path.resolve(config.root, config.build.outDir)
      const indexFile = path.join(out, 'index.html')
      if (!fs.existsSync(indexFile)) return
      const template = fs.readFileSync(indexFile, 'utf8')

      let channels: Channel[]
      try {
        channels = await fetchLiveChannels()
      } catch (e) {
        config.logger.warn(`[channel-pages] using built-in channel list: ${(e as Error).message}`)
        channels = FALLBACK_CHANNELS
      }
      fs.writeFileSync(path.join(out, 'channels.json'), JSON.stringify(channels))

      const { Resvg } = await import('@resvg/resvg-js')
      const ogDir = path.join(out, 'og')
      fs.mkdirSync(ogDir, { recursive: true })
      const card = (file: string, svg: string) => {
        const target = path.join(ogDir, file)
        if (fs.existsSync(target)) return
        const png = new Resvg(svg, {
          font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Noto Sans TC' },
          fitTo: { mode: 'width', value: 1200 },
        })
          .render()
          .asPng()
        fs.writeFileSync(target, png)
      }

      const root = siteUrl ? `${siteUrl}/` : base
      const last = Math.max(FIRST_CHANNEL, ...channels.map((c) => c.channel))
      const images = new Map<number, string>()
      // LINE and Facebook cache images by URL, and og/<n>.jpg keeps its name when a channel changes hands,
      // so the URL carries a hash of the picture.
      const versioned = (file: string) =>
        `${root}og/${file}?v=${createHash('sha1').update(fs.readFileSync(path.join(ogDir, file))).digest('hex').slice(0, 10)}`

      // Live channels without a hand-made og/<n>.jpg get a screenshot of their stage. Only deploy builds
      // (SITE_URL set) shoot, since they can reuse last build's images from the live site.
      const handmade = new Set<number>()
      for (const ch of channels) {
        const file = HANDMADE[ch.url] && path.join(ogDir, HANDMADE[ch.url])
        if (file && fs.existsSync(file)) {
          fs.copyFileSync(file, path.join(ogDir, `${ch.channel}.jpg`))
          handmade.add(ch.channel)
        }
      }
      const shots: Record<string, ShotEntry> = {}
      const chrome = process.env.CHROME_PATH ?? CHROME_PATHS.find((p) => fs.existsSync(p))
      const wantShots = (!!siteUrl || process.env.ENCORE_OG_SHOTS === '1') && process.env.ENCORE_OG_SHOTS !== '0'
      if (wantShots) {
        const prev: Record<string, ShotEntry> = await fetch(`${root}og/shots.json`, { signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}))
        const todo: Channel[] = []
        for (const ch of channels) {
          if (handmade.has(ch.channel)) continue
          const key = shotKey(ch)
          const old = prev[ch.channel]
          const fresh = old && old.key === key && Date.now() - Date.parse(old.at) < SHOT_MAX_AGE_DAYS * 864e5
          if (fresh) {
            const bytes = await fetch(`${root}og/${ch.channel}.jpg`, { signal: AbortSignal.timeout(8000) })
              .then((r) => (r.ok ? r.arrayBuffer() : null))
              .catch(() => null)
            if (bytes) {
              fs.writeFileSync(path.join(ogDir, `${ch.channel}.jpg`), Buffer.from(bytes))
              shots[ch.channel] = old
              continue
            }
          }
          todo.push(ch)
        }
        if (todo.length && chrome) {
          const puppeteer = await import('puppeteer-core')
          const browser = await puppeteer.launch({
            executablePath: chrome,
            headless: true,
            args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
          })
          try {
            for (const ch of todo) {
              const stage = /^https?:\/\//.test(ch.url) ? ch.url : `${root}${ch.url.replace(/^\//, '')}`
              // Open the stage as a page of its own: stages may only allow framing by encore.taipei (CSP frame-ancestors).
              // A YouTube link plays in the embedded player on the TV, so its share image is the video's thumbnail.
              let still: string | null = null
              const yt = youtubeId(ch.url)
              if (!yt) {
                const page = await browser.newPage()
                try {
                  await page.setViewport({ width: 1200, height: 630 })
                  const res = await page.goto(stage, { waitUntil: 'load', timeout: 40000 })
                  if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`)
                  await new Promise((r) => setTimeout(r, 9000))
                  still = `data:image/jpeg;base64,${await page.screenshot({ type: 'jpeg', quality: 90, encoding: 'base64' })}`
                } catch (e) {
                  config.logger.warn(`[channel-pages] could not open channel ${ch.channel}: ${(e as Error).message}`)
                } finally {
                  await page.close().catch(() => {})
                }
              }

              // Fallbacks, fetched only if the screenshot is unusable: the stage's own og:image, the one saved at
              // submission, then the GitHub preview of the author's repo.
              async function* candidates(): AsyncGenerator<[string, ShotEntry['from']]> {
                if (still) yield [still, 'stage']
                for (const u of yt ? youtubeThumbnails(yt) : []) {
                  const data = await asDataUrl(u)
                  if (data) yield [data, 'stage']
                }
                const own = /^https:\/\//.test(ch.url) ? await stageOgImage(ch.url) : null
                const saved = ch.og_image?.startsWith('https://') ? ch.og_image : null
                for (const u of new Set([own, saved, githubPreview(ch.author_url)].filter((u): u is string => !!u))) {
                  const data = await asDataUrl(u)
                  if (data) yield [data, 'preview']
                }
              }
              const card = await browser.newPage()
              try {
                await card.setViewport({ width: 1200, height: 630 })
                for await (const [src, from] of candidates()) {
                  try {
                    await card.setContent(shotPage(src, ch.channel, ch.title), { waitUntil: 'load', timeout: 20000 })
                    await card.evaluate('document.fonts.ready.then(() => true)')
                    const verdict = (await card.evaluate(INSPECT_STILL)) as string
                    if (verdict !== 'ok') {
                      config.logger.warn(`[channel-pages] channel ${ch.channel}: ${from} image is ${verdict}, trying the next one`)
                      continue
                    }
                    const jpg = await card.screenshot({ type: 'jpeg', quality: 86 })
                    fs.writeFileSync(path.join(ogDir, `${ch.channel}.jpg`), jpg)
                    shots[ch.channel] = { key: shotKey(ch), at: new Date().toISOString(), from }
                    config.logger.info(`[channel-pages] share image for channel ${ch.channel} (${from})`)
                    break
                  } catch (e) {
                    config.logger.warn(`[channel-pages] channel ${ch.channel}: ${from} image failed: ${(e as Error).message}`)
                  }
                }
              } finally {
                await card.close().catch(() => {})
              }
            }
          } finally {
            await browser.close()
          }
        }
      }
      fs.writeFileSync(path.join(ogDir, 'shots.json'), JSON.stringify(shots))

      for (const ch of channels) {
        if (fs.existsSync(path.join(ogDir, `${ch.channel}.jpg`))) images.set(ch.channel, versioned(`${ch.channel}.jpg`))
        else if (ch.og_image?.startsWith('https://')) images.set(ch.channel, ch.og_image)
        else if (youtubeId(ch.url)) images.set(ch.channel, youtubeThumbnails(youtubeId(ch.url)!)[1])
        else if (/^https:\/\//.test(ch.url)) {
          const own = await stageOgImage(ch.url)
          if (own) images.set(ch.channel, own)
        }
      }

      for (let n = FIRST_CHANNEL; n <= last + SPARE_CHANNELS; n++) {
        const ch = channels.find((c) => c.channel === n)
        let image = images.get(n)
        if (!image) {
          card(`${n}.png`, channelCard(n, !!ch))
          image = versioned(`${n}.png`)
        }
        const html = setMeta(template, {
          title: ch ? `第 ${n} 台｜${ch.title}｜台北安可大舞台` : `第 ${n} 台｜訊號徵求中｜台北安可大舞台`,
          description: ch
            ? `${ch.author} 做的台北安可舞台。${ch.message ?? ''}`.slice(0, 160)
            : `這一台還空著。用 AI 做一座你的台北安可舞台，送出就能佔下第 ${n} 台。`,
          image,
          url: `${root}${n}/`,
        })
        fs.mkdirSync(path.join(out, String(n)), { recursive: true })
        fs.writeFileSync(path.join(out, String(n), 'index.html'), html)
      }
      // The tower gets one page per occupied floor; it is also published at the site root, its canonical home.
      const towerIndex = path.join(out, 'tower', 'index.html')
      if (fs.existsSync(towerIndex)) {
        const towerTemplate = fs.readFileSync(towerIndex, 'utf8')
        const towerRoot = siteUrl ? `${siteUrl.replace(/\/beta$/, '')}/tower/` : `${base}tower/`
        for (const ch of channels) {
          const n = ch.channel
          const html = setMeta(towerTemplate, {
            title: `${n} 樓｜${ch.title}｜台北安可大樓`,
            description: `${ch.author} 做的台北安可派對，在台北安可大樓 ${n} 樓。${ch.message ?? ''}`.slice(0, 160),
            image: images.get(n) ?? versioned(`${n}.png`),
            url: `${towerRoot}${n}/`,
          })
          fs.mkdirSync(path.join(out, 'tower', String(n)), { recursive: true })
          fs.writeFileSync(path.join(out, 'tower', String(n), 'index.html'), html)
        }
      }
      config.logger.info(`[channel-pages] ${channels.length} live channels, pages ${FIRST_CHANNEL}–${last + SPARE_CHANNELS}`)
    },
  }
}
