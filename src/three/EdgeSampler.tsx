import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Rgb } from '@/lib/page-edge'

/**
 * Reports the average colour of the bottom row of the finished frame, a few times a second, so the
 * page behind Safari's floating tab bar can continue the picture. Runs after the composer (priority 2)
 * so the pixels are the ones on screen; any failure turns it off for good.
 */
export function EdgeSampler({ onColor }: { onColor: (rgb: Rgb) => void }) {
  const tick = useRef(0)
  const off = useRef(false)
  const buf = useRef<Uint8Array | null>(null)
  useFrame(({ gl }) => {
    if (off.current || ++tick.current % 12 !== 0 || document.hidden) return
    try {
      const ctx = gl.getContext()
      const w = ctx.drawingBufferWidth
      if (w < 8 || ctx.drawingBufferHeight < 8) return
      if (!buf.current || buf.current.length !== w * 4) buf.current = new Uint8Array(w * 4)
      gl.setRenderTarget(null)
      ctx.readPixels(0, 1, w, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, buf.current)
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < buf.current.length; i += 4) {
        r += buf.current[i]
        g += buf.current[i + 1]
        b += buf.current[i + 2]
      }
      onColor([r / w, g / w, b / w])
    } catch {
      off.current = true
    }
  }, 2)
  return null
}
