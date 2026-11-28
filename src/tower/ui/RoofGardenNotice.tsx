import { Sprout, X } from 'lucide-react'
import { useState } from 'react'

/** Shown on the roof while the garden's chat corner is resting. */
export function RoofGardenNotice() {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ink-btn slide-up fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-20 flex items-center gap-1.5 px-4 py-2 text-sm"
        data-on="true"
      >
        <Sprout className="size-4" /> 頂樓花園換季中
      </button>
    )

  return (
    <aside
      className="ink-card slide-up fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-30 w-[min(340px,calc(100vw-24px))] p-0"
      aria-label="頂樓花園"
    >
      <header className="flex items-center gap-2 border-b-2 border-[#0c0812] bg-[#ffd400] px-4 py-2.5">
        <Sprout className="size-4" />
        <div className="flex-1">
          <p className="text-sm leading-tight font-black">頂樓花園換季整理中</p>
          <p className="text-[11px] font-bold text-[#4a3a10]">園丁正在換盆、修剪、掛新燈串</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-black/10" aria-label="收起">
          <X className="size-4" />
        </button>
      </header>
      <div className="space-y-2 px-4 py-3 text-sm leading-relaxed text-[#13204f]">
        <p>天氣轉涼，頂樓花園正在換上冬天的植栽，聊天角也跟著休息一下。</p>
        <p>整理期間一樣可以上來吹吹風、看看台北風景，下次飛上來說不定就變樣了。</p>
      </div>
    </aside>
  )
}
