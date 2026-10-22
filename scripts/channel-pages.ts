import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { FALLBACK_CHANNELS, fetchLiveChannels, FIRST_CHANNEL, type Channel } from '../src/tv/channel-data.ts'

/** Empty "signal wanted" channels pre-rendered past the last live one, so fresh share links still unfurl. */
const SPARE_CHANNELS = 16
const FONTS = ['og-black.ttf', 'og-medium.ttf'].map((f) => path.resolve(__dirname, 'assets', f))

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

const SCANLINES = `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" fill-opacity="0.22"/></pattern>`
const GLOW = `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

function frame(inner: string, screen = '#0b1020') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${SCANLINES}${GLOW}
    <radialGradient id="room" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3a3115"/><stop offset="1" stop-color="#0b0906"/></radialGradient>
    <radialGradient id="tube" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${screen}" stop-opacity="0.6"/><stop offset="1" stop-color="#020306"/></radialGradient>
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
       <text x="150" y="470" font-family="Noto Sans TC" font-weight="900" font-size="64" fill="#ffffff">台北安可電視台</text>
       <text x="150" y="530" font-family="Noto Sans TC" font-weight="500" font-size="34" fill="#c9d3ff">ENCORE.TAIPEI · 第 ${n} 台 · 現正播放</text>`
    : `${bars}
       <rect x="100" y="396" width="1000" height="168" fill="#101010"/>
       <rect x="330" y="160" width="540" height="150" rx="12" fill="#000" fill-opacity="0.82"/>
       <text x="600" y="262" text-anchor="middle" font-family="Noto Sans TC" font-weight="900" font-size="84" fill="#ffffff">訊號徵求中</text>
       <text x="150" y="478" font-family="Noto Sans TC" font-weight="900" font-size="52" fill="#ffffff">第 ${n} 台 · 這一台還空著</text>
       <text x="150" y="532" font-family="Noto Sans TC" font-weight="500" font-size="30" fill="#c9d3ff">ENCORE.TAIPEI · 做一座你的台北安可舞台</text>`
  return frame(body, live ? '#16306b' : '#101010')
}

function hubCard() {
  return frame(
    `<text x="600" y="300" text-anchor="middle" font-family="Noto Sans TC" font-weight="900" font-size="104" fill="#fff4d6" filter="url(#glow)">台北安可電視台</text>
     <text x="600" y="378" text-anchor="middle" font-family="Noto Sans TC" font-weight="500" font-size="40" fill="#ffd400">ENCORE.TAIPEI</text>
     <text x="600" y="470" text-anchor="middle" font-family="Noto Sans TC" font-weight="500" font-size="34" fill="#c9d3ff">轉到每個人做的台北安可舞台 · 第 2026 台現正播放</text>`,
    '#3b2a0c',
  )
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
      card('tv.png', hubCard())

      const root = siteUrl ? `${siteUrl}/` : base
      const last = Math.max(FIRST_CHANNEL, ...channels.map((c) => c.channel))
      for (let n = FIRST_CHANNEL; n <= last + SPARE_CHANNELS; n++) {
        const ch = channels.find((c) => c.channel === n)
        let image: string
        if (ch?.og_image?.startsWith('https://')) image = ch.og_image
        else if (fs.existsSync(path.join(ogDir, `${n}.jpg`))) image = `${root}og/${n}.jpg`
        else {
          card(`${n}.png`, channelCard(n, !!ch))
          image = `${root}og/${n}.png`
        }
        const html = setMeta(template, {
          title: ch ? `第 ${n} 台｜${ch.title}｜台北安可電視台` : `第 ${n} 台｜訊號徵求中｜台北安可電視台`,
          description: ch
            ? `${ch.author} 做的台北安可舞台。${ch.message ?? ''}`.slice(0, 160)
            : `這一台還空著。用 AI 做一座你的台北安可舞台，送出就能佔下第 ${n} 台。`,
          image,
          url: `${root}${n}/`,
        })
        fs.mkdirSync(path.join(out, String(n)), { recursive: true })
        fs.writeFileSync(path.join(out, String(n), 'index.html'), html)
      }
      config.logger.info(`[channel-pages] ${channels.length} live channels, pages ${FIRST_CHANNEL}–${last + SPARE_CHANNELS}`)
    },
  }
}
