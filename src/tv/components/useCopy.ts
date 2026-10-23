import { useState } from 'react'

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, id = 'default') => {
    try {
      await navigator.clipboard.writeText(text).catch(() => {
        const area = document.createElement('textarea')
        area.value = text
        area.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        if (!ok) throw new Error('copy failed')
      })
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
    } catch {
      setCopied(null)
    }
  }
  return { copied, copy }
}
