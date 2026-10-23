import { Check, Copy } from 'lucide-react'
import { agentPrompt } from '../prompts'
import { AGENT_LOGOS } from './agent-logos'
import { useCopy } from './useCopy'

/** One tap copies the whole brief for an AI coding agent, in the spirit of Vercel's "Onboard Your Agent". */
export function OnboardAgent({ className = '' }: { className?: string }) {
  const { copied, copy } = useCopy()
  const done = copied === 'agent'
  return (
    <>
      <button
        type="button"
        onClick={() => copy(agentPrompt(), 'agent')}
        className={`group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[#0c0812] bg-white py-1.5 pr-4 pl-1.5 text-[15px] font-black text-[#0c0812] shadow-[2px_2px_0_#0c0812] transition-[transform,box-shadow,background] hover:-translate-y-px hover:bg-[#fffbea] hover:shadow-[3px_3px_0_#0c0812] active:translate-y-px active:shadow-[1px_1px_0_#0c0812] ${className}`}
      >
        <span aria-hidden className="relative inline-flex h-8 w-[68px] shrink-0">
          {AGENT_LOGOS.map((logo, i) => (
            <span
              key={logo.name}
              className="absolute flex size-8 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_#0c0812]"
              style={{ left: i * 18, zIndex: i }}
            >
              <svg viewBox="0 0 24 24" className="size-[17px]" fill={logo.color}>
                <path d={logo.path} />
              </svg>
            </span>
          ))}
        </span>
        <span className="grid place-items-center">
          <span className={`col-start-1 row-start-1 whitespace-nowrap transition-[opacity,scale] duration-200 ${done ? 'scale-95 opacity-0' : 'scale-100'}`}>
            一鍵交給你的 AI Agent
          </span>
          <span
            aria-hidden={!done}
            className={`col-start-1 row-start-1 whitespace-nowrap text-[#1a7f3c] transition-[opacity,scale] duration-200 ${done ? 'scale-100' : 'pointer-events-none scale-95 opacity-0'}`}
          >
            已複製！貼給你的 Agent
          </span>
        </span>
        <span aria-hidden className="relative flex size-4 shrink-0 text-[#4a4f6e]">
          <Copy className={`absolute inset-0 size-4 transition-[opacity,scale] duration-200 ${done ? 'scale-50 opacity-0' : ''}`} />
          <Check className={`absolute inset-0 size-4 text-[#1a7f3c] transition-[opacity,scale] duration-200 ${done ? '' : 'scale-50 opacity-0'}`} />
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {done ? '完整 prompt 已複製，貼給你的 AI Agent' : ''}
      </span>
    </>
  )
}
