import * as THREE from 'three'

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat: [number, number]) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(...repeat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function speckle(ctx: CanvasRenderingContext2D, s: number, n: number, dark: string, light: string) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? dark : light
    ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

/** Mono-yellow Backrooms wallpaper: faded vertical stripes and a tiny repeating diamond. */
export const wallpaper = (repeat: [number, number]) =>
  canvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#d6c47a'
      ctx.fillRect(0, 0, s, s)
      for (let x = 0; x < s; x += 32) {
        ctx.fillStyle = 'rgba(150,128,50,0.22)'
        ctx.fillRect(x, 0, 6, s)
        ctx.fillStyle = 'rgba(255,245,190,0.18)'
        ctx.fillRect(x + 16, 0, 2, s)
      }
      ctx.fillStyle = 'rgba(140,118,45,0.28)'
      for (let y = 8; y < s; y += 32)
        for (let x = 16; x < s; x += 32) {
          ctx.beginPath()
          ctx.moveTo(x, y - 5)
          ctx.lineTo(x + 4, y)
          ctx.lineTo(x, y + 5)
          ctx.lineTo(x - 4, y)
          ctx.fill()
        }
      speckle(ctx, s, 900, 'rgba(110,90,30,0.15)', 'rgba(255,250,210,0.12)')
    },
    repeat,
  )

/** Damp beige carpet. */
export const carpet = (repeat: [number, number]) =>
  canvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#b3a165'
      ctx.fillRect(0, 0, s, s)
      speckle(ctx, s, 9000, 'rgba(90,75,30,0.35)', 'rgba(230,215,150,0.25)')
      for (let i = 0; i < 5; i++) {
        const g = ctx.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 40 + Math.random() * 50)
        g.addColorStop(0, 'rgba(80,65,25,0.18)')
        g.addColorStop(1, 'rgba(80,65,25,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, s, s)
      }
    },
    repeat,
  )

/** Drop-ceiling tiles. */
export const ceiling = (repeat: [number, number]) =>
  canvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#d9d2b4'
      ctx.fillRect(0, 0, s, s)
      speckle(ctx, s, 700, 'rgba(120,110,80,0.35)', 'rgba(255,255,240,0.3)')
      ctx.strokeStyle = '#9d9373'
      ctx.lineWidth = 4
      ctx.strokeRect(0, 0, s, s)
    },
    repeat,
  )
