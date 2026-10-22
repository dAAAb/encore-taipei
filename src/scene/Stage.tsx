import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { beatNow, isChorus, pulse } from '@/audio/beat'
import { useClub } from '@/lib/store'
import { glyph } from '@/three/font3d'
import { cyl, rbox, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, shadowCatcher, toon } from '@/three/toon'
import { useFont3D } from '@/three/useFont3D'
import { MAYOR_POS } from './Mayor'

export const STAGE_Z = -11
export const STAGE_R = 6.5
export const STAGE_H = 1.2

function Platform() {
  const rings = useRef<THREE.Group>(null)
  useFrame(() => {
    const b = beatNow()
    rings.current!.children.forEach((m, i) => {
      const k = pulse(b - i * 0.25, 4)
      ;(m as THREE.Mesh).scale.setScalar(1 + 0.02 * k)
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.75 * k
    })
  })
  const ringMats = useMemo(
    () => [0, 1, 2, 3].map((i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? '#2f7bff' : '#ffd400').multiplyScalar(3), toneMapped: false, transparent: true })),
    [],
  )
  return (
    <group position={[0, 0, STAGE_Z]}>
      <Part geo={cyl(STAGE_R, STAGE_R + 0.25, STAGE_H, 64)} mat={toon('#221d33')} position={[0, STAGE_H / 2, 0]} outline={0.05} />
      <mesh geometry={cyl(STAGE_R - 0.05, STAGE_R - 0.05, 0.02, 64)} material={toon('#14111f')} position={[0, STAGE_H + 0.005, 0]} receiveShadow />
      <mesh geometry={torus(STAGE_R + 0.02, 0.05, Math.PI * 2, 96)} material={neon('#ffd400', 3.2)} position={[0, STAGE_H, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={torus(STAGE_R + 0.2, 0.04, Math.PI * 2, 96)} material={neon('#2f7bff', 3)} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <group ref={rings} position={[0, STAGE_H + 0.02, 0]}>
        {[1.2, 2.3, 3.4, 4.5].map((r, i) => (
          <mesh key={r} geometry={torus(r, 0.025, Math.PI * 2, 72)} material={ringMats[i]} rotation={[Math.PI / 2, 0, 0]} />
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, STAGE_H + 0.03, 0]} receiveShadow material={shadowCatcher(0.6)}>
        <circleGeometry args={[STAGE_R, 48]} />
      </mesh>
      {[-1, 1].map((s) => (
        <Part key={s} geo={rbox(1.6, 0.3, 0.9, 0.06)} mat={toon('#2a2440')} position={[s * 2.2, 0.15, STAGE_R + 0.35]} outline={0.03} />
      ))}
      <Part geo={rbox(3.2, 0.6, 1.0, 0.08)} mat={toon('#2a2440')} position={[0, 0.3, STAGE_R + 0.3]} outline={0.03} />
    </group>
  )
}

function drawLed(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, beat: number, speech: { short: string; tag: string } | null) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const slide = Math.floor(beat / 8) % 4
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#081558')
  g.addColorStop(0.55, '#1446c8')
  g.addColorStop(1, '#0a2a8f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = '#9fd0ff'
  const off = (beat * 18) % 80
  for (let x = -H; x < W + H; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x + off, 0)
    ctx.lineTo(x + off + 30, 0)
    ctx.lineTo(x + off + 30 - H, H)
    ctx.lineTo(x + off - H, H)
    ctx.fill()
  }
  ctx.restore()

  const k = pulse(beat, 5)
  const yellow = '#ffd400'
  const text = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 900) => {
    ctx.font = `${weight} ${size}px NotoTC, "Noto Sans TC", "PingFang TC", sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.14
    ctx.strokeStyle = '#0c0812'
    ctx.strokeText(s, x, y)
    ctx.fillStyle = color
    ctx.fillText(s, x, y)
  }

  if (speech) {
    ctx.fillStyle = yellow
    ctx.fillRect(60, 70, 230, 64)
    text(speech.tag, 175, 117, 40, '#0c1a5a', 'center')
    const s = speech.short
    const half = s.length > 10 ? Math.ceil(s.length / 2) : s.length
    text(s.slice(0, half), W / 2, 280, 96 + k * 6, '#ffffff', 'center')
    if (half < s.length) text(s.slice(half), W / 2, 400, 96 + k * 6, yellow, 'center')
  } else if (slide === 0 || slide === 3) {
    if (img) {
      const ih = H
      const iw = (img.width / img.height) * ih
      ctx.drawImage(img, W - iw - 20, 0, iw, ih)
      const fade = ctx.createLinearGradient(W - iw - 20, 0, W - iw + 120, 0)
      fade.addColorStop(0, 'rgba(20,70,200,1)')
      fade.addColorStop(1, 'rgba(20,70,200,0)')
      ctx.fillStyle = fade
      ctx.fillRect(W - iw - 20, 0, 140, H)
    }
    text('2033 · 來生 AFTERLIFE', 60, 110, 34, '#bfe3ff')
    text('台北安可', 52, 290, 150 + k * 8, yellow)
    text('TAIPEI ENCORE', 60, 370, 54, '#ffffff')
    text(slide === 0 ? '蔣萬安 · 黃金十年' : '城市持續進步，願景持續實現', 60, 440, 36, '#bfe3ff', 'left', 500)
  } else if (slide === 1) {
    text('為台北拚下一個', W / 2, 140, 48, '#ffffff', 'center')
    text('黃金十年', W / 2, 330, 190 + k * 10, yellow, 'center')
    text('GOLDEN DECADE · TAIPEI 2033', W / 2, 420, 40, '#bfe3ff', 'center', 500)
  } else {
    text('松山機場遷移 · 台北 AI 園區', W / 2, 110, 44, '#ffffff', 'center')
    text('870', W / 2 - 40, 320, 210 + k * 10, yellow, 'center')
    text('公頃', W / 2 + 230, 320, 70, '#ffffff', 'center')
    text('100 AI產業聚落 ｜ 110 中央公園 ｜ 90 永續生活', W / 2, 420, 34, '#bfe3ff', 'center', 500)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (let i = 0; i < 48; i++) {
    const h = (0.25 + 0.75 * Math.abs(Math.sin(i * 0.7 + beat * 1.7) * Math.cos(i * 0.31 + beat))) * 36 * (0.5 + k)
    ctx.fillRect(16 + i * 21, H - 8 - h, 14, h)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5)

  if (k > 0.85 && Math.floor(beat) % 4 === 0) {
    const y = Math.random() * H
    const slice = ctx.getImageData(0, y, W, 24)
    ctx.putImageData(slice, (Math.random() - 0.5) * 40, y)
  }
}

function LedWall() {
  const { tex, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { tex, ctx: canvas.getContext('2d', { willReadFrequently: true })! }
  }, [])
  const img = useRef<HTMLImageElement | null>(null)
  const last = useRef(0)

  useEffect(() => {
    const i = new Image()
    i.src = '/images/mayor-portrait.jpg'
    i.onload = () => (img.current = i)
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(16, 8, 48, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setZ(i, (x * x) / 40)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.35, 1.35, 1.35) }), [tex])

  useFrame(() => {
    const now = performance.now()
    if (now - last.current < 45) return
    last.current = now
    const sp = useClub.getState().speech
    drawLed(ctx, img.current, beatNow(), sp ? { short: sp.short, tag: sp.tag } : null)
    tex.needsUpdate = true
  })

  return (
    <group position={[0, STAGE_H + 4.6, STAGE_Z - 5.2]}>
      <mesh geometry={geo} material={mat} />
      <Part geo={rbox(16.8, 8.8, 0.5, 0.15)} mat={toon('#120f1c')} position={[0, 0, 1.2]} scale={[1, 1, 1]} outline={0.06} />
      <mesh geometry={rbox(16.9, 0.08, 0.08, 0.03)} material={neon('#ff2a4d', 3)} position={[0, 4.42, 1.6]} />
      <mesh geometry={rbox(16.9, 0.08, 0.08, 0.03)} material={neon('#ff2a4d', 3)} position={[0, -4.42, 1.6]} />
    </group>
  )
}

const BEAM_GEO = (() => {
  const g = new THREE.ConeGeometry(1.6, 14, 32, 1, true)
  g.translate(0, -7, 0)
  return g
})()

function beamMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.35 } },
    vertexShader: /* glsl */ `
      varying float vFade; varying vec3 vN; varying vec3 vV;
      void main() {
        vFade = clamp(-position.y / 14.0, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vFade; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float a = pow(1.0 - vFade, 1.4) * edge * uOpacity;
        gl_FragColor = vec4(uColor * 1.6, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

const BEAM_COLORS = ['#ffd400', '#2f7bff', '#ff2a4d', '#2ef2ff', '#ffd400', '#2f7bff']

function Truss() {
  const heads = useRef<THREE.Group>(null)
  const colors = BEAM_COLORS
  const mats = useMemo(() => BEAM_COLORS.map(beamMaterial), [])
  useFrame(() => {
    const b = beatNow()
    const chorus = isChorus(b)
    heads.current!.children.forEach((h, i) => {
      const ph = i * 1.1
      h.rotation.x = 0.35 * Math.sin(b * 0.25 * Math.PI + ph) + (chorus ? 0.15 * Math.sin(b * Math.PI) : 0)
      h.rotation.z = 0.5 * Math.sin(b * 0.125 * Math.PI + ph * 1.7)
      mats[i].uniforms.uOpacity.value = (chorus ? 0.42 : 0.26) * (0.6 + 0.4 * pulse(b + i * 0.5, 3))
    })
  })
  const xs = [-7, -4.2, -1.4, 1.4, 4.2, 7]
  return (
    <group position={[0, 11.5, STAGE_Z + 1.5]}>
      <Part geo={rbox(18, 0.35, 0.35, 0.05)} mat={toon('#3a3550')} position={[0, 0, 0]} outline={0.03} />
      <Part geo={rbox(18, 0.35, 0.35, 0.05)} mat={toon('#3a3550')} position={[0, 0, -3]} outline={0.03} />
      {[-9, 9].map((x) => (
        <Part key={x} geo={rbox(0.35, 0.35, 3.4, 0.05)} mat={toon('#3a3550')} position={[x, 0, -1.5]} outline={0.03} />
      ))}
      <group ref={heads}>
        {xs.map((x, i) => (
          <group key={x} position={[x, -0.35, 0]}>
            <Part geo={cyl(0.28, 0.22, 0.5, 14)} mat={toon('#1a1724')} outline={0.025} />
            <mesh geometry={cyl(0.2, 0.2, 0.04, 14)} material={neon(colors[i], 4)} position={[0, -0.27, 0]} />
            <mesh geometry={BEAM_GEO} material={mats[i]} position={[0, -0.3, 0]} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Lasers() {
  const g = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    const c = new THREE.CylinderGeometry(0.025, 0.025, 46, 6, 1, true)
    c.translate(0, 23, 0)
    return c
  }, [])
  useFrame(() => {
    const b = beatNow()
    const on = isChorus(b)
    g.current!.visible = on
    if (!on) return
    g.current!.children.forEach((l, i) => {
      const side = i < 4 ? -1 : 1
      const k = i % 4
      l.rotation.set(-Math.PI / 2 + 0.25 + 0.12 * Math.sin(b * 0.5 + k), 0, side * (0.35 + k * 0.18) + 0.25 * Math.sin(b * Math.PI * 0.25 + k * 0.8) * side)
    })
  })
  const cols = ['#39ff88', '#ff2a4d', '#2ef2ff', '#ffd400']
  return (
    <group ref={g}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={geo} material={neon(cols[i % 4], 5, 0.9)} position={[i < 4 ? -9 : 9, 10, STAGE_Z - 3]} />
      ))}
    </group>
  )
}

function Speakers() {
  const cones = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = pulse(beatNow(), 8)
    cones.current!.children.forEach((c) => c.scale.set(1, 1 + k * 0.6, 1))
  })
  return (
    <group ref={cones}>
      {[-1, 1].flatMap((s) =>
        [0, 1, 2].map((row) => (
          <group key={`${s}-${row}`} position={[s * 8.6, 0.85 + row * 1.6, STAGE_Z + 1.2 - row * 0.1]}>
            <Part geo={rbox(2.2, 1.5, 1.6, 0.1)} mat={toon('#1d1a28')} outline={0.04} />
            <Part geo={cyl(0.5, 0.42, 0.12, 24)} mat={toon('#0c0a12')} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.82]} outline={0.02} />
            <mesh geometry={torus(0.52, 0.03, Math.PI * 2, 32)} material={neon(row % 2 ? '#2f7bff' : '#ff2a4d', 2.5)} position={[0, 0, 0.86]} />
          </group>
        )),
      )}
    </group>
  )
}

function HoloRing() {
  const font = useFont3D()
  const ring = useRef<THREE.Group>(null)
  const text = '台北安可  TAIPEI ENCORE  黃金十年  2033  '.repeat(2)
  const chars = useMemo(() => {
    if (!font) return []
    const size = 0.42
    const items = [...text].map((ch) => ({ ch, g: glyph(font, ch) }))
    const total = items.reduce((s, it) => s + it.g.advance * size, 0)
    const r = total / (Math.PI * 2)
    let acc = 0
    return items.map((it) => {
      const a = (acc / total) * Math.PI * 2
      acc += it.g.advance * size
      return { ...it, a, r, size }
    })
  }, [font, text])
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y -= dt * 0.25
  })
  return (
    <group ref={ring} position={[MAYOR_POS.x, STAGE_H + 0.12, MAYOR_POS.z]}>
      {chars.map((c, i) =>
        c.g.geo ? (
          <group key={i} rotation={[0, c.a, 0]}>
            <mesh geometry={c.g.geo} material={neon('#2ef2ff', 2.6)} position={[0, 0, c.r]} scale={c.size} />
          </group>
        ) : null,
      )}
    </group>
  )
}

export function Stage() {
  return (
    <group>
      <Platform />
      <LedWall />
      <Truss />
      <Lasers />
      <Speakers />
      <HoloRing />
    </group>
  )
}
