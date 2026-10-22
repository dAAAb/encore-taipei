import { useState } from 'react'

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, id = 'default') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
    } catch {
      setCopied(null)
    }
  }
  return { copied, copy }
}
