import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { beatNow, isChorus } from '@/audio/beat'
import achievements from '@/data/achievements.json'
import { hypeRef, useClub } from '@/lib/store'
import { capsule, cyl, limb, rbox, sphere } from '@/three/geo'
import { ink, neon, toon } from '@/three/toon'

type Kind = 0 | 1 | 2 | 3
const JUMP = 0
const WAVE = 1
const STICK = 2
const PHONE = 3

interface Person {
  x: number
  z: number
  s: number
  phase: number
  kind: Kind
  stickColor: number
}

const SHIRTS = ['#231b36', '#2d1d40', '#14263c', '#3b1724', '#1c2c2b', '#2a2a3a', '#1a1a24', '#402033']
const FAN_SHIRTS = ['#1e5bd6', '#f2c40c']
const HAIRS = ['#0d0a0e', '#120d0b', '#1d130f', '#0d0a0e', '#2b1a12', '#b8325f', '#3fc9f2', '#d9d1c4']
const STICKS = ['#ffd400', '#2f7bff', '#ffd400', '#2f7bff', '#ff2a4d', '#2ef2ff']

const SHOUTS = [
  '蔣萬安我愛你！',
  '台北安可！',
  '安可！安可！',
  '市長看這裡！！',
  '凍蒜！凍蒜！',
  '啊啊啊啊啊——！',
  '旋轉再一次！',
  '黃金十年衝啊！',
]

function makeCrowd(): Person[] {
  const out: Person[] = []
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let z = -3.4; z <= 9.2; z += 0.82) {
    for (let x = -11.6; x <= 11.6; x += 0.76) {
      const jx = x + (rnd() - 0.5) * 0.5
      const jz = z + (rnd() - 0.5) * 0.45
      const r = rnd()
      const kind: Kind = r < 0.38 ? JUMP : r < 0.6 ? WAVE : r < 0.88 ? STICK : PHONE
      out.push({ x: jx, z: jz, s: 0.88 + rnd() * 0.22, phase: rnd(), kind, stickColor: Math.floor(rnd() * STICKS.length) })
    }
  }
  return out
}

export const CROWD = makeCrowd()

const BODY_GEO = capsule(0.2, 0.86)
const HEAD_GEO = sphere(0.14, 16, 12)
const HAIR_GEO = sphere(0.152, 16, 12)
const ARM_GEO = limb(0.058, 0.5)
const STICK_GEO = (() => {
  const g = cyl(0.03, 0.03, 0.42, 8).clone()
  g.translate(0, -0.78, 0)
  return g
})()
const PHONE_GEO = (() => {
  const g = rbox(0.09, 0.16, 0.02, 0.01).clone()
  g.translate(0, -0.66, 0)
  return g
})()

export function Crowd() {
  const n = CROWD.length
  const body = useRef<THREE.InstancedMesh>(null)
  const bodyInk = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.InstancedMesh>(null)
  const hair = useRef<THREE.InstancedMesh>(null)
  const hairInk = useRef<THREE.InstancedMesh>(null)
  const armA = useRef<THREE.InstancedMesh>(null)
  const armB = useRef<THREE.InstancedMesh>(null)
  const armAInk = useRef<THREE.InstancedMesh>(null)
  const armBInk = useRef<THREE.InstancedMesh>(null)
  const sticks = useRef<THREE.InstancedMesh>(null)
  const phones = useRef<THREE.InstancedMesh>(null)

  const stickIdx = useMemo(() => CROWD.map((p, i) => (p.kind === STICK ? i : -1)).filter((i) => i >= 0), [])
  const phoneIdx = useMemo(() => CROWD.map((p, i) => (p.kind === PHONE ? i : -1)).filter((i) => i >= 0), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const armMats = useMemo(() => ({ a: CROWD.map(() => new THREE.Matrix4()), b: CROWD.map(() => new THREE.Matrix4()) }), [])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    let k = 7
    const pick = <T,>(arr: T[]) => arr[(k = (k * 31 + 17) % 9973) % arr.length]
    CROWD.forEach((_, i) => {
      const fan = (k = (k * 13 + 5) % 9973) % 9 === 0
      c.set(fan ? pick(FAN_SHIRTS) : pick(SHIRTS))
      body.current!.setColorAt(i, c)
      armA.current!.setColorAt(i, c)
      armB.current!.setColorAt(i, c)
      c.set(pick(HAIRS))
      hair.current!.setColorAt(i, c)
      c.set('#c99a7a')
      head.current!.setColorAt(i, c)
    })
    stickIdx.forEach((pi, j) => {
      c.set(STICKS[CROWD[pi].stickColor]).multiplyScalar(4)
      sticks.current!.setColorAt(j, c)
    })
    for (const m of [body, armA, armB, hair, head, sticks]) if (m.current!.instanceColor) m.current!.instanceColor.needsUpdate = true
    bodyInk.current!.instanceMatrix = body.current!.instanceMatrix
    hairInk.current!.instanceMatrix = hair.current!.instanceMatrix
    armAInk.current!.instanceMatrix = armA.current!.instanceMatrix
    armBInk.current!.instanceMatrix = armB.current!.instanceMatrix
  }, [stickIdx])

  useFrame((_, dt) => {
    const beat = beatNow()
    hypeRef.value = Math.max(0, hypeRef.value - dt * 0.18)
    const hype = Math.min(1, hypeRef.value + (isChorus(beat) ? 0.35 : 0))
    const t = performance.now() / 1000

    for (let i = 0; i < n; i++) {
      const p = CROWD[i]
      const b = beat + p.phase * 0.18
      const jumpAmp = (p.kind === JUMP ? 0.2 : 0.07) * (0.55 + hype * 0.9)
      const up = Math.max(0, Math.sin(Math.PI * b))
      const y = jumpAmp * up * up
      const s = p.s

      dummy.position.set(p.x, y + 0.78 * s, p.z)
      dummy.rotation.set(0, 0, 0.04 * Math.sin(Math.PI * b * 0.5 + p.phase * 6))
      dummy.scale.set(1.12 * s, s, 0.78 * s)
      dummy.updateMatrix()
      body.current!.setMatrixAt(i, dummy.matrix)

      const hx = p.x + 0.03 * Math.sin(t * 2 + p.phase * 9)
      dummy.position.set(hx, y + 1.6 * s, p.z)
      dummy.rotation.set(-0.15, 0, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      head.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.set(hx, y + 1.63 * s, p.z + 0.03 * s)
      dummy.updateMatrix()
      hair.current!.setMatrixAt(i, dummy.matrix)

      let fa = 0
      let sa = 0.25
      let fb = 0
      let sb = 0.25
      const raise = hype > 0.6 ? 1 : 0
      if (p.kind === JUMP) {
        sa = sb = 2.55 + 0.25 * Math.sin(Math.PI * b)
        fa = fb = 0.25
      } else if (p.kind === WAVE) {
        sa = 2.3 + 0.55 * Math.sin(Math.PI * b * 0.5 + p.phase * 4)
        fa = 0.3
        sb = raise ? 2.6 : 0.3
      } else if (p.kind === STICK) {
        sa = 2.5 + 0.5 * Math.sin(Math.PI * b + p.phase)
        fa = 0.35
        sb = raise ? 2.4 : 0.35 + 0.2 * up
        fb = raise ? 0.3 : 0.6
      } else {
        fa = 2.15
        sa = 0.15
        sb = raise ? 2.5 : 0.3
      }

      dummy.scale.setScalar(s)
      dummy.position.set(p.x + 0.23 * s, y + 1.38 * s, p.z)
      dummy.rotation.set(fa, 0, sa, 'ZXY')
      dummy.updateMatrix()
      armA.current!.setMatrixAt(i, dummy.matrix)
      armMats.a[i].copy(dummy.matrix)

      dummy.position.set(p.x - 0.23 * s, y + 1.38 * s, p.z)
      dummy.rotation.set(fb, 0, -sb, 'ZXY')
      dummy.updateMatrix()
      armB.current!.setMatrixAt(i, dummy.matrix)
      armMats.b[i].copy(dummy.matrix)
    }
    stickIdx.forEach((pi, j) => sticks.current!.setMatrixAt(j, armMats.a[pi]))
    phoneIdx.forEach((pi, j) => phones.current!.setMatrixAt(j, armMats.a[pi]))

    for (const m of [body, head, hair, armA, armB, sticks, phones]) m.current!.instanceMatrix.needsUpdate = true
  })

  const white = toon('#ffffff')
  return (
    <group>
      <instancedMesh ref={body} args={[BODY_GEO, white, n]} castShadow frustumCulled={false} />
      <instancedMesh ref={bodyInk} args={[BODY_GEO, ink(0.03), n]} frustumCulled={false} />
      <instancedMesh ref={head} args={[HEAD_GEO, white, n]} castShadow frustumCulled={false} />
      <instancedMesh ref={hair} args={[HAIR_GEO, white, n]} frustumCulled={false} />
      <instancedMesh ref={hairInk} args={[HAIR_GEO, ink(0.02), n]} frustumCulled={false} />
      <instancedMesh ref={armA} args={[ARM_GEO, white, n]} castShadow frustumCulled={false} />
      <instancedMesh ref={armB} args={[ARM_GEO, white, n]} castShadow frustumCulled={false} />
      <instancedMesh ref={armAInk} args={[ARM_GEO, ink(0.018), n]} frustumCulled={false} />
      <instancedMesh ref={armBInk} args={[ARM_GEO, ink(0.018), n]} frustumCulled={false} />
      <instancedMesh ref={sticks} args={[STICK_GEO, neon('#ffffff', 1), stickIdx.length]} frustumCulled={false} />
      <instancedMesh ref={phones} args={[PHONE_GEO, neon('#dff3ff', 2.2), phoneIdx.length]} frustumCulled={false} />
      <CrowdChatter />
    </group>
  )
}

interface Chat {
  id: number
  person: number
  text: string
  shout: boolean
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function CrowdChatter() {
  const [chats, setChats] = useState<Chat[]>([])
  const started = useClub((s) => s.started)
  const queue = useRef<string[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (!started) return
    let alive = true
    let timer = 0
    const spawn = () => {
      if (!alive) return
      if (queue.current.length === 0) queue.current = shuffled(achievements.map((a) => a.short))
      const shout = Math.random() < 0.28
      const text = shout ? SHOUTS[Math.floor(Math.random() * SHOUTS.length)] : queue.current.pop()!
      const candidates = CROWD.map((p, i) => (p.z > -2.5 && p.z < 7.5 && Math.abs(p.x) < 10 ? i : -1)).filter((i) => i >= 0)
      const person = candidates[Math.floor(Math.random() * candidates.length)]
      const id = nextId.current++
      setChats((c) => [...c.slice(-5), { id, person, text, shout }])
      window.setTimeout(() => setChats((c) => c.filter((x) => x.id !== id)), shout ? 2600 : 4200)
      timer = window.setTimeout(spawn, 750 + Math.random() * 900)
    }
    timer = window.setTimeout(spawn, 1200)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [started])

  return (
    <>
      {chats.map((c) => {
        const p = CROWD[c.person]
        return (
          <Html key={c.id} position={[p.x, 2.25 * p.s + 0.25, p.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={c.shout ? 'crowd-bubble crowd-bubble--shout' : 'crowd-bubble'}>{c.text}</div>
          </Html>
        )
      })}
    </>
  )
}
