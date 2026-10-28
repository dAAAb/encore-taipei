import type { ReactNode } from 'react'

/**
 * Channel descriptions are plain text with a few light touches: a line starting with "## " is a small heading, a
 * line starting with "1. " is bold, and links can be written as [title](https://…) or as a bare https:// address.
 * Only https links are made clickable.
 */
const LINK = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s)）]+)/g

function inline(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) out.push(line.slice(last, at))
    const href = m[2] ?? m[3]
    out.push(
      <a key={at} href={href} target="_blank" rel="noreferrer noopener" className="font-bold break-words text-[#1f4fd1] underline underline-offset-2">
        {m[1] ?? href}
      </a>,
    )
    last = at + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function RichMessage({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`text-[15px] leading-relaxed break-words text-[#2a2f52] ${className}`}>
      {text.split('\n').map((line, i) =>
        line.startsWith('## ') ? (
          <p key={i} className="mt-4 mb-1 text-sm font-black tracking-wide text-[#c8234a] first:mt-0">
            {line.slice(3)}
          </p>
        ) : line.trim() === '' ? (
          <div key={i} className="h-2" aria-hidden />
        ) : /^\d+\.\s/.test(line) ? (
          <p key={i} className="font-black text-[#13204f]">
            {inline(line)}
          </p>
        ) : (
          <p key={i}>{inline(line)}</p>
        ),
      )}
    </div>
  )
}
