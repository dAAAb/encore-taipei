import { Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import making from '@/data/making-of.json'
import { track } from '@/lib/analytics'
import { channelUrl, stageUrl } from '../routing'
import { useTv } from '../store'
import { useCopy } from './useCopy'

/** Channel details: who made it, what they said, the prompt, and a share link for this channel. */
export function InfoSheet() {
  const open = useTv((s) => s.infoOpen)
  const setOpen = useTv((s) => s.setInfoOpen)
  const slot = useTv((s) => s.dial[s.index])
  const { copied, copy } = useCopy()
  if (!slot) return null

  const ch = slot.kind === 'empty' ? null : slot.channel
  const prompt = ch?.prompt ?? (slot.number === 2026 ? making.prompt : null)
  const link = channelUrl(slot.number)
  const share = async () => {
    const data = { title: `第 ${slot.number} 台｜${ch?.title ?? '訊號徵求中'}｜台北安可電視台`, url: link }
    track('share', { method: 'share' in navigator ? 'native' : 'copy', content_type: 'channel', item_id: String(slot.number), place: 'info' })
    if (navigator.share) await navigator.share(data).catch(() => {})
    else copy(link, 'link')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="ink-card w-[min(92vw,420px)] overflow-y-auto rounded-none border-0 border-l-[2.5px] p-0 sm:rounded-l-2xl">
        <SheetHeader className="border-b-2 border-dashed border-[#0c0812]/25 p-5">
          <p className="text-xs font-black tracking-[0.2em] text-[#c8234a]">CH {slot.number}{slot.kind === 'pending' ? ' · 審核中' : ''}</p>
          <SheetTitle className="text-2xl leading-tight font-black text-[#13204f]">{ch?.title ?? '訊號徵求中'}</SheetTitle>
          <SheetDescription className="text-[#4a4f6e]">
            {ch ? (
              <>
                by{' '}
                {ch.author_url ? (
                  <a href={ch.author_url} target="_blank" rel="noreferrer" className="font-bold text-[#1f4fd1] underline">
                    {ch.author}
                  </a>
                ) : (
                  <b>{ch.author}</b>
                )}
                {ch.tools ? ` · ${ch.tools}` : ''}
              </>
            ) : (
              '這一台還空著，等你來做。'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {ch?.message && <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#2a2f52]">{ch.message}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="ink-btn flex items-center justify-center gap-1.5 px-3 py-2 text-sm" data-on="true" onClick={share}>
              <Share2 className="size-4" /> 分享這一台
            </button>
            <button type="button" className="ink-btn flex items-center justify-center gap-1.5 px-3 py-2 text-sm" onClick={() => copy(link, 'link')}>
              {copied === 'link' ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === 'link' ? '已複製' : '複製連結'}
            </button>
          </div>
          <p className="truncate rounded-lg bg-white/60 px-2.5 py-1.5 font-mono text-xs text-[#4a4f6e]">{link}</p>

          {ch && (
            <a href={stageUrl(ch.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-[#1f4fd1] underline">
              <ExternalLink className="size-4" /> 在新分頁全螢幕開啟這座舞台
            </a>
          )}
          {ch?.author_url && (
            <a href={ch.author_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-[#1f4fd1] underline">
              <ExternalLink className="size-4" /> 作者／原始碼
            </a>
          )}

          {prompt && (
            <section>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-[#c8234a]">製作這台用的 prompt</p>
                <button type="button" className="ink-btn flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => copy(prompt, 'prompt')}>
                  {copied === 'prompt' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === 'prompt' ? '已複製' : '複製'}
                </button>
              </div>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl border-2 border-dashed border-[#0c0812]/40 bg-white/70 p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#13204f]">
                {prompt}
              </pre>
              <p className="mt-1.5 text-xs text-[#6a6f8e]">歡迎拿去改做，做好了轉到最後一台上架。</p>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
