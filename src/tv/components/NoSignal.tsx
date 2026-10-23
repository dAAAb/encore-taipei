import { Sparkles, Upload } from 'lucide-react'
import { useTv } from '../store'
import { OnboardAgent } from './OnboardAgent'

const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

/** The first unclaimed channel: colour bars and an invitation to build the next stage. */
export function NoSignal({ number }: { number: number }) {
  const setGuideOpen = useTv((s) => s.setGuideOpen)
  const setSubmitOpen = useTv((s) => s.setSubmitOpen)

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex flex-[7]">
        {BARS.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex flex-[1]">
        {['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'].map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex flex-[2] bg-[#101010]">
        <div className="flex-[5] bg-[#00214c]" />
        <div className="flex-[5] bg-white" />
        <div className="flex-[5] bg-[#32006a]" />
        <div className="flex-[10] bg-[#101010]" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="ink-card slide-up w-full max-w-md p-5 text-center sm:p-7">
          <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2.5 py-0.5 text-[11px] font-black tracking-[0.16em] text-[#0c0812]">
            CH {number} · NO SIGNAL
          </p>
          <h2 className="mt-3 text-[34px] font-black leading-none tracking-[0.04em] sm:text-[42px]">訊號徵求中</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#2a2f52]">
            第 <b>{number}</b> 台還空著，可以是你的。用 AI 做一座你自己的台北安可舞台，送出後馬上就能在這一台預覽。
          </p>
          <div className="mt-5 grid gap-2.5">
            <button type="button" className="ink-btn flex items-center justify-center gap-2 px-5 py-2.5 text-base" data-on="true" onClick={() => setSubmitOpen(true)}>
              <Upload className="size-4" /> 我做好了，上架這一台
            </button>
            <button type="button" className="ink-btn flex items-center justify-center gap-2 px-5 py-2.5 text-base" onClick={() => setGuideOpen(true)}>
              <Sparkles className="size-4" /> 怎麼做？給我 prompt
            </button>
            <OnboardAgent className="mt-1" />
          </div>
          <p className="mt-4 text-xs text-[#6a6f8e]">按 ← 轉回上一台，或用右下角遙控器</p>
        </div>
      </div>
    </div>
  )
}
