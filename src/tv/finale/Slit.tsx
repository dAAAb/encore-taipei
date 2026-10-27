import { useEffect, useRef, useState } from 'react'

/**
 * The seam at the end of the credits: one thin line of light that breathes slowly, brighter when
 * you reach for it. On `opening` it tears wide into white light with hyperspace streaks.
 */
export function Slit({ opening, onEnter }: { opening: boolean; onEnter: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState(false)
  const hoverRef = useRef(false)
  const openAt = useRef<number | null>(null)

  useEffect(() => {
    hoverRef.current = hover
  }, [hover])

  useEffect(() => {
    if (opening && openAt.current === null) openAt.current = performance.now()
  }, [opening])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const start = performance.now()
    let glow = 1
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (now: number) => {
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const t = (now - start) / 1000
      const appear = Math.min(1, t / 1.2)
      const open = openAt.current === null ? 0 : Math.min(1, (now - openAt.current) / 1050)
      const openE = open * open * open
      ctx.clearRect(0, 0, w, h)

      // One slow breath every 2.6 s; reaching for it (hover) eases the glow up.
      const breath = 0.5 - 0.5 * Math.cos((t * Math.PI * 2) / 2.6)
      glow += ((hoverRef.current ? 1.5 : 1) - glow) * 0.08
      const blur = (10 + 34 * breath) * dpr * glow * appear
      const alpha = Math.min(1, (0.45 + 0.55 * breath) * Math.min(1, glow) + openE)
      const coreW = (2 + 2.5 * breath + openE * w) * dpr * (0.6 + 0.4 * appear)
      const reach = Math.min(1, t / 0.6)
      const y0 = h / 2 - (h / 2) * reach
      const y1 = h / 2 + (h / 2) * reach
      ctx.save()
      ctx.shadowColor = 'rgba(200,220,255,0.95)'
      ctx.shadowBlur = blur * (1 + openE * 4)
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fillRect(cx - coreW / 2, y0, coreW, y1 - y0)
      ctx.fillRect(cx - coreW / 4, y0, coreW / 2, y1 - y0)
      ctx.restore()

      if (open > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - openE * 0.6)})`
        for (let k = 0; k < 90; k++) {
          const a = (k / 90) * Math.PI * 2 + k * 0.37
          const r0 = (0.05 + ((t * 2.5 + k * 0.13) % 1) * 0.6) * w
          const len = (0.04 + open * 0.35) * w
          ctx.lineWidth = (1 + open * 3) * dpr
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0)
          ctx.lineTo(cx + Math.cos(a) * (r0 + len), h / 2 + Math.sin(a) * (r0 + len))
          ctx.stroke()
        }
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, (open - 0.55) / 0.45)})`
        ctx.fillRect(0, 0, w, h)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 ${opening ? '' : 'cursor-pointer'}`}
      onClick={(e) => {
        e.stopPropagation()
        if (!opening) onEnter()
      }}
      onPointerMove={(e) => setHover(Math.abs(e.clientX - window.innerWidth / 2) < window.innerWidth * 0.18)}
      onPointerLeave={() => setHover(false)}
    >
      <canvas ref={ref} className={`h-full w-full ${opening ? 'shake' : ''}`} />
      <button
        type="button"
        className="sr-only"
        disabled={opening}
        onClick={(e) => {
          e.stopPropagation()
          onEnter()
        }}
      >
        穿過亮線，回到房間
      </button>
    </div>
  )
}
