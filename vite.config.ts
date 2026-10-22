import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { channelPages } from './scripts/channel-pages.ts'

/** Deploy under a sub-path (GitHub Pages project sites) with BASE_PATH=/repo-name/. */
const base = process.env.BASE_PATH ?? '/'
/** Public origin, e.g. https://example.com/taipei-encore — social crawlers need absolute og:image URLs. */
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '')

function shareUrls(): Plugin {
  const root = siteUrl ? `${siteUrl}/` : base
  return {
    name: 'share-urls',
    transformIndexHtml(html, ctx) {
      const page = ctx.path.replace(/^\//, '').replace(/index\.html$/, '')
      const url = `${root}${page}`
      return {
        html: html.replaceAll('%SITE_ROOT%', root).replaceAll('%PAGE_URL%', url),
        tags: siteUrl
          ? [
              { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
              { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
            ]
          : [],
      }
    },
  }
}

/** /2026, /2027 … are TV channels served by the hub page. */
function channelRoutes(): Plugin {
  const rewrite = (url = '') => url.replace(/^(.*?\/)(\d{4,5})\/?(\?.*)?$/, (_m, pre: string, _n, q = '') => `${pre}index.html${q}`)
  return {
    name: 'channel-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url)
        next()
      })
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), shareUrls(), channelRoutes(), channelPages({ siteUrl, base })],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rollupOptions: {
      input: {
        tv: path.resolve(import.meta.dirname, 'index.html'),
        club: path.resolve(import.meta.dirname, 'club/index.html'),
        admin: path.resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
  server: { host: '0.0.0.0', port: 4733, strictPort: true },
  preview: { host: '0.0.0.0', port: 4733, allowedHosts: true },
})
