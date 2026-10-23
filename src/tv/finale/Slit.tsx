import { useEffect, useRef, useState } from 'react'

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

/**
 * The seam at the end of the credits: a glowing crack that flickers, sends out portal ripples and
 * pulls sparks toward itself. On `opening` it tears wide into white light with hyperspace streaks.
 */
export function Slit({ opening, onEnter }: { opening: boolean; onEnter: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState(false)
  const hoverRef = useRef(false)
  const openAt = useRef<number | null>(null)
  hoverRef.current = hover

  useEffect(() => {
    if (opening && openAt.current === null) openAt.current = performance.now()
  }, [opening])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const start = performance.now()
    const motes: Mote[] = []
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

      const flicker = 0.82 + 0.18 * Math.sin(t * 23) * Math.sin(t * 7.3) + (Math.random() < 0.04 ? -0.35 : 0)
      const hoverK = hoverRef.current ? 1.6 : 1
      const glowW = (18 + 10 * Math.sin(t * 2.2)) * dpr * hoverK * appear

      const leak = ctx.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, 0)
      leak.addColorStop(0, 'rgba(120,160,255,0)')
      leak.addColorStop(0.5, `rgba(170,200,255,${0.12 * appear * flicker * hoverK})`)
      leak.addColorStop(1, 'rgba(120,160,255,0)')
      ctx.fillStyle = leak
      ctx.fillRect(0, 0, w, h)

      const period = 1.7
      for (let k = 0; k < 3; k++) {
        const p = ((t + k * (period / 3)) % period) / period
        ctx.strokeStyle = `rgba(190,215,255,${(1 - p) * 0.45 * appear})`
        ctx.lineWidth = (2.5 - 1.5 * p) * dpr
        ctx.beginPath()
        ctx.ellipse(cx, h / 2, w * 0.42 * p + 2, h * 0.62 * (0.25 + 0.75 * p), 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (motes.length < 140 && Math.random() < 0.9) {
        const side = Math.random() < 0.5 ? -1 : 1
        motes.push({ x: cx + side * w * (0.15 + Math.random() * 0.35), y: Math.random() * h, vx: 0, vy: (Math.random() - 0.5) * 20 * dpr, life: 0 })
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]
        const dx = cx - m.x
        m.vx += Math.sign(dx) * 260 * dpr * (1 / 60) * hoverK
        m.x += m.vx / 60
        m.y += m.vy / 60
        m.life += 1 / 60
        if (Math.abs(cx - m.x) < 3 * dpr || m.life > 3) {
          motes.splice(i, 1)
          continue
        }
        const a = Math.min(1, m.life * 2) * appear
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, 1.4 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      const coreW = (3 + openE * w) * dpr * (0.6 + 0.4 * appear)
      const reach = Math.min(1, t / 0.6)
      const y0 = h / 2 - (h / 2) * reach
      const y1 = h / 2 + (h / 2) * reach
      ctx.save()
      ctx.shadowColor = 'rgba(200,220,255,0.95)'
      ctx.shadowBlur = glowW * (1 + openE * 4)
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flicker + openE)})`
      ctx.fillRect(cx - coreW / 2, y0, coreW, y1 - y0)
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
      {!opening && <p className="tv-caption gate-pulse pointer-events-none absolute inset-x-0 bottom-[16vh] text-center text-sm tracking-[0.35em] text-white/85">點一下，穿過去</p>}
    </div>
  )
}
