/**
 * Google Analytics 4. Set VITE_GA_ID (e.g. G-XXXXXXXXXX) in `.env.production`; without it every call is a no-op.
 * Local dev never reports.
 */
const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() ?? ''

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

let on = false

/** `pageView: false` for pages that report their own virtual views or run inside another page's iframe. */
export function initAnalytics({ pageView = true }: { pageView?: boolean } = {}) {
  if (on || !GA_ID || import.meta.env.DEV) return
  on = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: pageView })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
}

export function track(name: string, params?: Record<string, string | number | boolean | undefined>) {
  if (on) window.gtag('event', name, params)
}

/** A virtual page view for client-side routes like /2027/. */
export function trackPage(path: string, title: string) {
  if (on) window.gtag('event', 'page_view', { page_location: `${location.origin}${path}`, page_path: path, page_title: title })
}
