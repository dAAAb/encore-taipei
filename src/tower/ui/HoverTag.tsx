import { useEffect, useState } from 'react'
import { floorTitle, type Floor } from '../layout'
import { useTower } from '../store'

/** Desktop: a tag next to the pointer naming the floor under it. */
export function HoverTag({ floors }: { floors: Floor[] }) {
  const hover = useTower((s) => s.hover)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const move = (e: PointerEvent) => setAt(e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null)
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const f = hover != null ? floors[hover] : null
  if (!f || !at) return null
  return (
    <div className="pointer-events-none fixed z-30 -translate-y-1/2 rounded-xl border-2 border-[#0c0812] bg-[#0b0a10]/90 px-3 py-1.5 shadow-[3px_3px_0_#0c0812]" style={{ left: at.x + 18, top: at.y }}>
      <p className="flex items-center gap-2 whitespace-nowrap">
        <span className="elevator-digits" style={{ fontSize: 18 }}>{f.number}F</span>
        <span className="max-w-[16rem] truncate text-sm font-bold text-[#fff4d6]">{floorTitle(f)}</span>
      </p>
      <p className="text-[11px] font-bold text-[#ffd400]">點一下飛進去</p>
    </div>
  )
}
