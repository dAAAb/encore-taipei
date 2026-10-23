import { ExternalLink, ScrollText } from 'lucide-react'
import achievements from '@/data/achievements.json'
import platform from '@/data/platform.json'
import { TAIPEI_ENCORE_URL } from '@/audio/youtube'
import { MakingOf } from '@/components/MakingOf'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { track } from '@/lib/analytics'

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Source({ url }: { url: string | null }) {
  if (!url) return <span className="text-xs text-[#6a6f8e]">出處：競選文宣</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#1f4fd1] underline-offset-2 hover:underline">
      {host(url)} <ExternalLink className="size-3" />
    </a>
  )
}

export function DataSheet() {
  return (
    <Sheet onOpenChange={(o) => o && track('datasheet_open')}>
      <SheetTrigger render={<button type="button" className="ink-btn flex items-center gap-1.5 px-3 py-1.5 text-sm" />}>
        <ScrollText className="size-4" /> 政績資料
      </SheetTrigger>
      <SheetContent side="right" className="w-full border-l-[2.5px] border-[#0c0812] bg-[#fbf3e2] p-0 text-[#13204f] sm:max-w-md">
        <SheetHeader className="border-b-2 border-[#0c0812] px-5 pt-5 pb-3">
          <SheetTitle className="text-xl font-black text-[#13204f]">台北安可 · 資料庫</SheetTitle>
          <SheetDescription className="text-[#4a4f6e]">群眾喊的、市長說的，全都附上出處。</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="done" className="min-h-0 flex-1 px-4 pb-4">
          <TabsList className="w-full border-2 border-[#0c0812] bg-[#efe3c9]">
            <TabsTrigger value="done" className="font-black data-active:bg-[#ffd400]">四年政績 {achievements.length}</TabsTrigger>
            <TabsTrigger value="next" className="font-black data-active:bg-[#ffd400]">黃金十年政見 {platform.length}</TabsTrigger>
            <TabsTrigger value="about" className="font-black data-active:bg-[#ffd400]">關於</TabsTrigger>
          </TabsList>
          <TabsContent value="done" className="min-h-0">
            <ScrollArea className="h-[calc(100dvh-226px)] pr-3">
              <ol className="space-y-3 pb-6">
                {achievements.map((a) => (
                  <li key={a.short} className="rounded-xl border-2 border-[#0c0812] bg-white/60 p-3 shadow-[3px_3px_0_#2b2f9e]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black leading-snug">{a.short}</p>
                      <span className="shrink-0 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2 text-[11px] font-black">{a.tag}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#2a2f52]">{a.fact}</p>
                    <div className="mt-1">
                      <Source url={a.source} />
                    </div>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="next" className="min-h-0">
            <ScrollArea className="h-[calc(100dvh-226px)] pr-3">
              <ol className="space-y-3 pb-6">
                {platform.map((p) => (
                  <li key={p.short} className="rounded-xl border-2 border-[#0c0812] bg-white/60 p-3 shadow-[3px_3px_0_#2b2f9e]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black leading-snug">{p.short}</p>
                      <span className="shrink-0 rounded-full border-2 border-[#0c0812] bg-[#9fcbef] px-2 text-[11px] font-black">{p.tag}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#2a2f52]">{p.detail}</p>
                    <div className="mt-1">
                      <Source url={p.source} />
                    </div>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="about" className="space-y-3 text-[13px] leading-relaxed text-[#2a2f52]">
            <p>
              「台北安可之夜」是一件粉絲創作的互動 3D 作品：想像 2033 年，松山機場遷移後的台北 AI 園區裡，一間向電玩《電馭叛客 2077》傳奇酒吧「來生（Afterlife）」致敬的未來夜店。
              畫面採用 Colorfigures 的手繪描線、三階平塗明暗與扁平藍色投影，再加上霓虹夜店的光影。
            </p>
            <p>
              施政成績整理自臺北市政府（gov.taipei）新聞稿與中央社、聯合報等報導；政見來自蔣萬安競選文宣與公開記者會。部分政見仍屬規劃或預算爭取階段，詳見各條說明。
            </p>
            <p>
              背景音樂為蔣萬安 YouTube 頻道的〈台北安可｜2026蔣萬安連任競選主題曲〉官方 MV，以 YouTube 內嵌播放器播放：
              <a href={TAIPEI_ENCORE_URL} target="_blank" rel="noreferrer" className="ml-1 font-bold text-[#1f4fd1] underline">
                在 YouTube 開啟
              </a>
              。若無法播放，會自動改用網站內建的流行龐克節拍。
            </p>
            <p className="font-bold">本網站非蔣萬安競選團隊官方網站。</p>
          </TabsContent>
        </Tabs>
        <footer className="border-t-2 border-dashed border-[#0c0812]/25 px-4 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <MakingOf />
        </footer>
      </SheetContent>
    </Sheet>
  )
}
