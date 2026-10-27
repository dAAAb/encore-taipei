import { useEffect, useRef } from 'react'

/** Analogue snow with a rolling bar, drawn at low resolution and scaled up. */
export function StaticNoise({ className = '', strength = 1 }: { className?: string; strength?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const w = (canvas.width = 192)
    const h = (canvas.height = 108)
    const img = ctx.createImageData(w, h)
    let raf = 0
    let frame = 0
    const draw = () => {
      frame++
      const roll = (frame * 3) % (h + 40)
      const d = img.data
      for (let y = 0; y < h; y++) {
        const band = Math.abs(y - roll + 20) < 9 ? 1.35 : 1
        for (let x = 0; x < w; x++) {
          const v = Math.min(255, Math.random() * 255 * band * strength)
          const i = (y * w + x) * 4
          d[i] = v
          d[i + 1] = v
          d[i + 2] = v
          d[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [strength])

  return <canvas ref={ref} className={`h-full w-full [image-rendering:pixelated] ${className}`} aria-hidden />
}
