import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { beatNow, pulse } from '@/audio/beat'
import { engine } from '@/audio/synth'
import platform from '@/data/platform.json'
import stage3d from '@/data/stage3d.json'
import { hypeRef, useClub, type PlatformItem } from '@/lib/store'
import { glyph, layout, loadFont, wrapSlogan } from '@/three/font3d'
import { repairNormals } from '@/three/geo'
import { INK, toon } from '@/three/toon'
import { MAYOR_POS, MAYOR_SCALE } from './Mayor'

interface Line {
  id: number
  text: string
  item: PlatformItem | null
  side: 1 | -1
}

const PAPER = '#fbf3e2'
const TEXT_FRONT = toon('#13204f')
const TEXT_SIDE = toon('#ffd400')
const HI_FRONT = toon('#1f6bff')
const HI_SIDE = toon('#ffd400')
const PAPER_FACE = new THREE.MeshBasicMaterial({ color: PAPER })
const PAPER_SIDE = toon('#e6d3ae')
const INK_MAT = new THREE.MeshBasicMaterial({ color: INK })
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: '#2b2f9e', transparent: true, opacity: 0.85 })

const isHighlight = (ch: string) => /[0-9%.]/.test(ch) || '兆萬億'.includes(ch)

const easeOutBack = (t: number) => {
  const c1 = 1.9
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIn = (t: number) => t * t * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function bubbleShape(w: number, h: number, r: number, side: 1 | -1, inflate = 0) {
  const W = w + inflate * 2
  const H = h + inflate * 2
  const R = r + inflate
  const x0 = -W / 2
  const x1 = W / 2
  const y0 = -H / 2
  const y1 = H / 2
  const tx = side === 1 ? x0 + R + 0.5 : x1 - R - 0.5
  const bw = 0.3 + inflate * 0.6
  const tipX = tx - side * (0.85 + inflate * 0.9)
  const tipY = y0 - 0.8 - inflate * 1.4
  const s = new THREE.Shape()
  s.moveTo(x0 + R, y0)
  s.lineTo(tx - bw, y0)
  if (side === 1) {
    s.lineTo(tipX, tipY)
    s.lineTo(tx + bw, y0)
  } else {
    s.lineTo(tipX, tipY)
    s.lineTo(tx + bw, y0)
  }
  s.lineTo(x1 - R, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + R)
  s.lineTo(x1, y1 - R)
  s.quadraticCurveTo(x1, y1, x1 - R, y1)
  s.lineTo(x0 + R, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - R)
  s.lineTo(x0, y0 + R)
  s.quadraticCurveTo(x0, y0, x0 + R, y0)
  return s
}

interface CharAnim {
  mesh: THREE.Mesh
  target: THREE.Vector3
  from: THREE.Vector3
  exit: THREE.Vector3
  spin: THREE.Euler
  delay: number
}

const SIZE = 0.62
const tmp = new THREE.Vector3()

function Bubble({ line, font, onDone }: { line: Line; font: Font; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const charsGroup = useRef<THREE.Group>(null)
  const born = useRef(performance.now() / 1000)
  const done = useRef(false)
  const { camera, viewport, size } = useThree()

  const built = useMemo(() => {
    const lines = wrapSlogan(line.text, 9)
    const lay = layout(font, lines, SIZE)
    const w = lay.width + 1.1
    const h = lay.height + 0.7
    const extrude = { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 }
    const paper = repairNormals(new THREE.ExtrudeGeometry(bubbleShape(w, h, 0.45, line.side), extrude))
    const inkGeo = repairNormals(new THREE.ExtrudeGeometry(bubbleShape(w, h, 0.45, line.side, 0.08), { ...extrude, bevelEnabled: false, depth: 0.1 }))
    const shadow = repairNormals(new THREE.ShapeGeometry(bubbleShape(w, h, 0.45, line.side, 0.02), 8))

    const chars: CharAnim[] = []
    lay.chars.forEach((c, i) => {
      if (!c.glyph.geo) return
      const hi = isHighlight(c.ch)
      const mesh = new THREE.Mesh(c.glyph.geo, hi ? [HI_FRONT, HI_SIDE] : [TEXT_FRONT, TEXT_SIDE])
      mesh.castShadow = false
      const target = new THREE.Vector3(c.x, c.y, 0.22)
      const a = Math.random() * Math.PI * 2
      const from = new THREE.Vector3(Math.cos(a) * (16 + Math.random() * 6), Math.sin(a) * (10 + Math.random() * 5), 4 + Math.random() * 8)
      const b = Math.random() * Math.PI * 2
      const exit = new THREE.Vector3(Math.cos(b) * 18, Math.sin(b) * 12 + 4, 6 + Math.random() * 6)
      const spin = new THREE.Euler((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6)
      chars.push({ mesh, target, from, exit, spin, delay: 0.32 + i * 0.06 })
    })
    const life = 0.32 + chars.length * 0.06 + 0.8 + 2.6 + chars.length * 0.08
    return { paper, inkGeo, shadow, chars, w, h, life }
  }, [font, line])

  useEffect(() => {
    const g = charsGroup.current!
    built.chars.forEach((c) => g.add(c.mesh))
    return () => {
      built.chars.forEach((c) => g.remove(c.mesh))
      built.paper.dispose()
      built.inkGeo.dispose()
      built.shadow.dispose()
    }
  }, [built])

  useFrame(() => {
    const age = performance.now() / 1000 - born.current
    const narrow = size.width < size.height
    const vw = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 4, MAYOR_POS.z)).width
    const fit = Math.min(1, (vw * (narrow ? 0.92 : 0.42)) / built.w)
    const cx = narrow ? line.side * 0.4 : line.side * (1.0 + (built.w * fit) / 2)
    const headTop = MAYOR_POS.y + 1.8 * MAYOR_SCALE
    const cy = headTop + (narrow ? 1.4 : 0.5) + (built.h / 2 + 0.8) * fit
    const pos = tmp.set(MAYOR_POS.x + cx, cy, MAYOR_POS.z + 1.4).applyMatrix4(camera.matrixWorldInverse)
    const cam = camera as THREE.PerspectiveCamera
    const halfH = -pos.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const halfW = halfH * cam.aspect
    const fitView = Math.min(1, (halfW * 1.9) / built.w, (halfH * 1.1) / (built.h + 0.8))
    const bw = (built.w * fit * fitView) / 2
    const bh = ((built.h + 0.8) * fit * fitView) / 2
    pos.x = THREE.MathUtils.clamp(pos.x, -halfW + bw + 0.1 * halfW, halfW - bw - 0.1 * halfW)
    pos.y = Math.min(pos.y, halfH * 0.86 - bh)
    pos.applyMatrix4(camera.matrixWorld)
    group.current!.position.set(pos.x, pos.y + Math.sin(age * 1.6) * 0.08, pos.z)
    group.current!.quaternion.copy(camera.quaternion)
    group.current!.rotateZ(Math.sin(age * 1.2) * 0.02)

    const outStart = built.life
    const pop = age < 0.45 ? easeOutBack(clamp01(age / 0.45)) : 1
    const shrink = age > outStart + 0.35 ? 1 - easeIn(clamp01((age - outStart - 0.35) / 0.35)) : 1
    body.current!.scale.setScalar(Math.max(0.0001, pop * shrink))
    group.current!.scale.setScalar(fit * fitView)

    const beat = beatNow()
    built.chars.forEach((c, i) => {
      const m = c.mesh
      if (age < outStart) {
        const t = clamp01((age - c.delay) / 0.75)
        const e = easeOutBack(t)
        m.position.lerpVectors(c.from, c.target, e)
        if (t >= 1) m.position.y += 0.06 * pulse(beat + i * 0.12, 5)
        const r = 1 - easeOut(t)
        m.rotation.set(c.spin.x * r, c.spin.y * r, c.spin.z * r)
        m.scale.setScalar(SIZE * (1 + r * 1.4))
        m.visible = age > c.delay
      } else {
        const t = clamp01((age - outStart - i * 0.018) / 0.55)
        const e = easeIn(t)
        m.position.set(c.target.x + c.exit.x * e, c.target.y + c.exit.y * e, c.target.z + c.exit.z * e)
        m.rotation.set(c.spin.x * e, c.spin.y * e, c.spin.z * e)
        m.scale.setScalar(SIZE * (1 + e))
      }
    })

    if (!done.current && age > outStart + 0.8) {
      done.current = true
      onDone()
    }
  })

  return (
    <group ref={group}>
      <group ref={body}>
        <mesh geometry={built.shadow} material={SHADOW_MAT} position={[0.22, -0.24, -0.14]} />
        <mesh geometry={built.inkGeo} material={INK_MAT} position={[0, 0, -0.04]} />
        <mesh geometry={built.paper} material={[PAPER_FACE, PAPER_SIDE]} />
      </group>
      <group ref={charsGroup} />
    </group>
  )
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function MayorSpeech() {
  const [font, setFont] = useState<Font | null>(null)
  const [line, setLine] = useState<Line | null>(null)
  const started = useClub((s) => s.started)
  const setSpeech = useClub((s) => s.setSpeech)
  const queue = useRef<PlatformItem[]>([])
  const count = useRef(0)
  const timer = useRef(0)

  useEffect(() => {
    let alive = true
    loadFont().then((f) => {
      if (!alive) return
      const all = [...platform.map((p) => p.short), ...stage3d.hype, ...stage3d.signage].join('')
      const uniq = [...new Set(all)]
      let i = 0
      const warm = () => {
        const end = Math.min(uniq.length, i + 24)
        for (; i < end; i++) glyph(f, uniq[i])
        if (i < uniq.length) window.setTimeout(warm, 0)
        else if (alive) setFont(f)
      }
      warm()
    })
    return () => {
      alive = false
    }
  }, [])

  const next = useMemo(
    () => () => {
      const n = count.current++
      const side: 1 | -1 = n % 2 === 0 ? 1 : -1
      if (n % 4 === 3) {
        const text = stage3d.hype[Math.floor(Math.random() * stage3d.hype.length)]
        setLine({ id: n, text, item: null, side })
        setSpeech(null)
      } else {
        if (queue.current.length === 0) queue.current = shuffled(platform)
        const item = queue.current.pop()!
        setLine({ id: n, text: item.short, item, side })
        setSpeech(item)
      }
      hypeRef.value = 1
      engine.scream(0.75)
    },
    [setSpeech],
  )

  useEffect(() => {
    if (!started || !font) return
    timer.current = window.setTimeout(next, 2200)
    return () => window.clearTimeout(timer.current)
  }, [started, font, next])

  const handleDone = () => {
    setLine(null)
    setSpeech(null)
    timer.current = window.setTimeout(next, 900 + Math.random() * 3200)
  }

  if (!font || !line) return null
  return <Bubble key={line.id} line={line} font={font} onDone={handleDone} />
}
