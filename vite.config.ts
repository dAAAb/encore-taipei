import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Deploy under a sub-path (GitHub Pages project sites) with BASE_PATH=/repo-name/. */
const base = process.env.BASE_PATH ?? '/'
/** Public origin, e.g. https://example.com/taipei-encore — social crawlers need absolute og:image URLs. */
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '')

function shareUrls(): Plugin {
  const root = siteUrl ? `${siteUrl}/` : base
  return {
    name: 'share-urls',
    transformIndexHtml(html) {
      return {
        html: html.replaceAll('%SITE_ROOT%', root),
        tags: siteUrl
          ? [
              { tag: 'link', attrs: { rel: 'canonical', href: root }, injectTo: 'head' },
              { tag: 'meta', attrs: { property: 'og:url', content: root }, injectTo: 'head' },
            ]
          : [],
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), shareUrls()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { host: '0.0.0.0', port: 4733, strictPort: true },
  preview: { host: '0.0.0.0', port: 4733, allowedHosts: true },
})
