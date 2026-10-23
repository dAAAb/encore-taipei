import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { beatNow, pulse } from '@/audio/beat'
import { useClub } from '@/lib/store'
import { cyl, limb, rbox, repairNormals, sphere, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'

export const MAYOR_POS = new THREE.Vector3(0, 1.2, -8.6)
export const MAYOR_SCALE = 2.2
export const HIP_H = 0.865
/** World position of the mayor's head, updated every frame. */
export const mayorHead = new THREE.Vector3()

const SUIT = '#2a3f9a'
const SUIT_DARK = '#1d2b6e'
const TROUSER = '#1b2558'
const SKIN = '#f2c9a4'
const SKIN_SHADE = '#e3ae86'
const HAIR = '#141012'
const SHIRT = '#f6f4ef'
const TIE = '#9fcbef'

export type Limb3 = [number, number, number]
export type Leg4 = [number, number, number, number]

export interface Pose {
  y: number
  pitch: number
  lean: number
  tilt: number
  twist: number
  head: Limb3
  aP: Limb3
  aN: Limb3
  lP: Leg4
  lN: Leg4
  rot: number
  x: number
  z: number
}

const REST: Pose = {
  y: 0, pitch: 0, lean: 0, tilt: 0, twist: 0,
  head: [0, 0, 0],
  aP: [0.05, 0.12, 0.15],
  aN: [0.05, 0.12, 0.15],
  lP: [0, 0.04, 0, 0],
  lN: [0, 0.04, 0, 0],
  rot: 0, x: 0, z: 0,
}

const TAU = Math.PI * 2
const ease = (t: number) => t * t * (3 - 2 * t)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const seg = (lb: number, a: number, b: number) => clamp01((lb - a) / (b - a))

function P(over: Partial<Pose>): Pose {
  return { ...REST, ...over }
}

interface Move {
  name: string
  beats: number
  pose: (lb: number) => Pose
}

const groove: Move = {
  name: 'groove',
  beats: 8,
  pose: (lb) => {
    const k = 0.5 + 0.5 * Math.cos(TAU * lb)
    const s = Math.sin(Math.PI * lb)
    const step = Math.sin((Math.PI * lb) / 2)
    return P({
      y: -0.05 * (1 - k),
      tilt: 0.06 * s,
      twist: 0.15 * step,
      head: [0.14 * Math.sin(TAU * lb), 0.1 * step, 0],
      aP: [0.5 + 0.45 * s, 0.25, 1.3 + 0.4 * s],
      aN: [0.5 - 0.45 * s, 0.25, 1.3 - 0.4 * s],
      lP: [-0.1 * (1 - k) - 0.15 * Math.max(0, s), 0.08, 0.3 * (1 - k) + 0.3 * Math.max(0, s), 0.1],
      lN: [-0.1 * (1 - k) - 0.15 * Math.max(0, -s), 0.08, 0.3 * (1 - k) + 0.3 * Math.max(0, -s), 0.1],
      x: 0.35 * step,
    })
  },
}

const spin: Move = {
  name: 'spin',
  beats: 4,
  pose: (lb) => {
    if (lb < 1) {
      const t = ease(lb)
      return P({
        y: -0.06 * t,
        twist: -0.7 * t,
        head: [0.1 * t, -0.3 * t, 0],
        aP: [0.9 * t, 0.2, 1.8 * t],
        aN: [0.9 * t, 0.2, 1.8 * t],
        lP: [-0.15 * t, 0.06, 0.35 * t, 0],
        lN: [-0.15 * t, 0.06, 0.35 * t, 0],
      })
    }
    if (lb < 2.5) {
      const t = (lb - 1) / 1.5
      return P({
        y: 0.04,
        rot: easeOut(t) * TAU * 2,
        twist: -0.7 * (1 - ease(Math.min(1, t * 3))),
        aP: [0.55, 0.12, 1.7],
        aN: [0.55, 0.12, 1.7],
        lP: [0, 0.02, 0.05, 0.6],
        lN: [-0.9, 0.12, 1.6, 0.4],
        head: [0, 0, 0],
      })
    }
    const t = ease(seg(lb, 2.5, 2.8))
    return P({
      y: 0.06 * t + 0.04 * (1 - t),
      lean: -0.05 * t,
      head: [-0.18 * t, 0.15 * t, 0.12 * t],
      aN: [2.6 * t + 0.55 * (1 - t), 0.35 * t, 1.9],
      aP: [0.15, 0.12 + 0.2 * t, 0.15],
      lP: [-0.05, 0.02, 0.18 * t, 1.0 * t + 0.6 * (1 - t)],
      lN: [-0.05 - 0.85 * (1 - t), 0.02, 0.18 * t + 1.6 * (1 - t), 1.0],
    })
  },
}

const moonwalk: Move = {
  name: 'moonwalk',
  beats: 8,
  pose: (lb) => {
    if (lb < 4) {
      const f = lb % 1
      const side = Math.floor(lb) % 2 === 0
      const bend = Math.sin(Math.PI * f)
      const a: Leg4 = [-0.15, 0.04, 0.7, 0.9]
      const b: Leg4 = [0.05, 0.04, 0.02, 0]
      const mix = (u: Leg4, v: Leg4, m: number) => u.map((x, i) => x * m + v[i] * (1 - m)) as Leg4
      const m = 0.5 + 0.5 * Math.cos(Math.PI * f)
      return P({
        y: -0.02 - 0.03 * bend,
        lean: 0.08,
        z: -1.1 * (lb / 4),
        head: [0.05, 0, 0.06 * Math.sin(Math.PI * lb)],
        aP: [0.35 + 0.25 * Math.sin(Math.PI * lb), 0.15, 1.1],
        aN: [0.35 - 0.25 * Math.sin(Math.PI * lb), 0.15, 1.1],
        lP: side ? mix(a, b, m) : mix(b, a, m),
        lN: side ? mix(b, a, m) : mix(a, b, m),
      })
    }
    const w = lb - 4
    const s = Math.sin(Math.PI * w)
    return P({
      y: -0.03 * Math.abs(s),
      z: -1.1 * (1 - w / 4),
      twist: 0.18 * s,
      tilt: -0.05 * s,
      head: [0.12 * Math.sin(TAU * w), -0.18 * s, 0],
      aP: [0.6 - 0.6 * s, 0.2, 1.4],
      aN: [0.6 + 0.6 * s, 0.2, 1.4],
      lP: [-0.45 * Math.max(0, s), 0.05, 0.6 * Math.max(0, s), 0.15],
      lN: [-0.45 * Math.max(0, -s), 0.05, 0.6 * Math.max(0, -s), 0.15],
    })
  },
}

const point: Move = {
  name: 'point',
  beats: 4,
  pose: (lb) => {
    const t = ease(seg(lb, 0, 0.5))
    const pop = pulse(lb, 5)
    const kick = lb > 2.9 && lb < 3.6 ? Math.sin(Math.PI * seg(lb, 2.9, 3.6)) : 0
    return P({
      y: -0.03 * pop,
      tilt: 0.12 * t,
      head: [-0.22 * t, 0.35 * t, 0],
      aP: [2.75 * t, 0.65 * t, 0.05],
      aN: [0.3, 0.75 * t, 2.0 * t],
      lP: [-1.3 * kick, 0.08 + 0.1 * kick, 0.2 * kick + 0.05, 0.4 * kick],
      lN: [-0.1, 0.06, 0.35 * pop + 0.1, 0.2 * pop],
    })
  },
}

const lean: Move = {
  name: 'lean',
  beats: 4,
  pose: (lb) => {
    const t = ease(seg(lb, 0.5, 1.6)) * (1 - ease(seg(lb, 3.0, 3.9)))
    return P({
      pitch: 0.62 * t,
      head: [-0.35 * t, 0, 0],
      aP: [-0.15 * t, 0.08, 0.05],
      aN: [-0.15 * t, 0.08, 0.05],
      lP: [0, 0.03, 0, -0.62 * t],
      lN: [0, 0.03, 0, -0.62 * t],
    })
  },
}

const ROUTINE: Move[] = [groove, spin, moonwalk, point, spin, lean, { ...groove, beats: 4 }, spin]
const ROUTINE_BEATS = ROUTINE.reduce((s, m) => s + m.beats, 0)

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t
  const la = <T extends number[]>(x: T, y: T) => x.map((v, i) => l(v, y[i])) as T
  let da = ((b.rot - a.rot) % TAU + TAU * 1.5) % TAU - TAU / 2
  if (t >= 1) da = b.rot - a.rot
  return {
    y: l(a.y, b.y), pitch: l(a.pitch, b.pitch), lean: l(a.lean, b.lean), tilt: l(a.tilt, b.tilt), twist: l(a.twist, b.twist),
    head: la(a.head, b.head), aP: la(a.aP, b.aP), aN: la(a.aN, b.aN), lP: la(a.lP, b.lP), lN: la(a.lN, b.lN),
    rot: a.rot + da * t, x: l(a.x, b.x), z: l(a.z, b.z),
  }
}

export function poseAt(beat: number): Pose {
  const b = ((beat % ROUTINE_BEATS) + ROUTINE_BEATS) % ROUTINE_BEATS
  let acc = 0
  for (let i = 0; i < ROUTINE.length; i++) {
    const m = ROUTINE[i]
    if (b < acc + m.beats) {
      const lb = b - acc
      const cur = m.pose(lb)
      if (lb < 0.5) {
        const prev = ROUTINE[(i - 1 + ROUTINE.length) % ROUTINE.length]
        const end = prev.pose(prev.beats - 1e-4)
        end.rot = end.rot % TAU
        return lerpPose(end, cur, ease(lb / 0.5))
      }
      return cur
    }
    acc += m.beats
  }
  return REST
}

interface ArmRefs {
  shoulder: THREE.Group | null
  elbow: THREE.Group | null
}
interface LegRefs {
  hip: THREE.Group | null
  knee: THREE.Group | null
  ankle: THREE.Group | null
}

function Arm({ side, refs, glove }: { side: 1 | -1; refs: ArmRefs; glove?: boolean }) {
  return (
    <group ref={(g) => { refs.shoulder = g }} position={[0.25 * side, 0.47, 0]}>
      <Part geo={sphere(0.078, 14, 10)} mat={toon(SUIT)} outline={0.014} />
      <Part geo={limb(0.062, 0.25)} mat={toon(SUIT)} outline={0.016} />
      <group ref={(g) => { refs.elbow = g }} position={[0, -0.25, 0]}>
        <Part geo={limb(0.056, 0.22)} mat={toon(SUIT)} outline={0.016} />
        <Part geo={cyl(0.058, 0.058, 0.05, 14)} mat={toon(SHIRT)} position={[0, -0.25, 0]} outline={0.01} />
        {glove ? (
          <group position={[0, -0.32, 0]}>
            <Part geo={sphere(0.06, 14, 10)} mat={toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 })} outline={0.012} />
            <mesh geometry={sphere(0.018, 8, 6)} material={neon('#fff6c8', 4)} position={[0.03, 0.02, 0.04]} />
            <mesh geometry={sphere(0.014, 8, 6)} material={neon('#c8f1ff', 4)} position={[-0.03, -0.01, 0.045]} />
          </group>
        ) : (
          <Part geo={sphere(0.056, 14, 10)} mat={toon(SKIN)} position={[0, -0.32, 0]} outline={0.012} />
        )}
      </group>
    </group>
  )
}

function Leg({ side, refs }: { side: 1 | -1; refs: LegRefs }) {
  return (
    <group ref={(g) => { refs.hip = g }} position={[0.1 * side, 0, 0]}>
      <Part geo={limb(0.078, 0.36)} mat={toon(TROUSER)} outline={0.016} />
      <group ref={(g) => { refs.knee = g }} position={[0, -0.36, 0]}>
        <Part geo={limb(0.068, 0.36)} mat={toon(TROUSER)} outline={0.016} />
        <group ref={(g) => { refs.ankle = g }} position={[0, -0.42, 0]}>
          <Part geo={cyl(0.052, 0.052, 0.07, 12)} mat={toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 })} position={[0, 0.02, 0]} outline={0.01} />
          <Part geo={rbox(0.12, 0.085, 0.27, 0.04)} mat={toon('#16131a')} position={[0, -0.04, 0.055]} outline={0.016} />
          <mesh geometry={rbox(0.1, 0.012, 0.16, 0.005)} material={neon('#ffffff', 1.6)} position={[0, 0.003, 0.09]} />
        </group>
      </group>
    </group>
  )
}

/** Flat extruded panel from a 2D outline (lapels, shirt V, tie), lying in the XY plane at the given depth. */
function panel(points: [number, number][], depth = 0.012) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.computeVertexNormals()
  return repairNormals(g)
}

function Eye({ side }: { side: 1 | -1 }) {
  return (
    <group position={[0.047 * side, 0.112, 0.108]}>
      <mesh geometry={sphere(0.024, 14, 10)} material={toon('#fbfaf6')} scale={[1.25, 0.82, 0.45]} />
      <mesh geometry={sphere(0.015, 12, 8)} material={toon('#2a1a14')} position={[0.002 * side, -0.002, 0.008]} scale={[1, 1.1, 0.5]} />
      <mesh geometry={sphere(0.0055, 8, 6)} material={neon('#ffffff', 1.4)} position={[0.006 * side, 0.005, 0.015]} />
      <mesh geometry={torus(0.027, 0.0035, Math.PI, 16)} material={toon('#1a1214')} position={[0, 0.002, 0.004]} scale={[1.15, 0.75, 1]} />
    </group>
  )
}

function Head({ mouthRef }: { mouthRef: React.RefObject<THREE.Mesh | null> }) {
  const smile = useMemo(() => torus(0.034, 0.008, Math.PI, 16), [])
  return (
    <group>
      <Part geo={sphere(0.13, 28, 20)} mat={toon(SKIN)} scale={[0.88, 1.08, 0.96]} position={[0, 0.1, 0]} outline={0.016} />
      {[1, -1].map((s) => (
        <Part key={s} geo={sphere(0.03, 12, 8)} mat={toon(SKIN_SHADE)} scale={[0.45, 1, 0.8]} position={[0.114 * s, 0.092, -0.005]} outline={0.008} />
      ))}
      <Part geo={sphere(0.136, 28, 18)} mat={toon(HAIR)} scale={[0.92, 0.72, 0.98]} position={[0, 0.17, -0.022]} outline={0.016} />
      <Part geo={sphere(0.12, 20, 14)} mat={toon(HAIR)} scale={[0.94, 0.86, 0.68]} position={[0, 0.115, -0.066]} outline={0.012} />
      <Part geo={sphere(0.085, 20, 14)} mat={toon(HAIR)} scale={[1.25, 0.62, 0.95]} position={[0.018, 0.242, 0.045]} rotation={[-0.35, 0, 0.18]} outline={0.014} />
      <Part geo={sphere(0.055, 16, 12)} mat={toon(HAIR)} scale={[1.3, 0.6, 1]} position={[0.07, 0.232, 0.075]} rotation={[-0.4, 0.4, -0.3]} outline={0.012} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={rbox(0.022, 0.05, 0.03, 0.01)} material={toon(HAIR)} position={[0.107 * s, 0.13, 0.03]} />
      ))}
      <Eye side={1} />
      <Eye side={-1} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={rbox(0.058, 0.016, 0.016, 0.007)} material={toon(HAIR)} position={[0.047 * s, 0.153, 0.112]} rotation={[0, 0, -0.1 * s]} />
          <mesh geometry={sphere(0.018, 8, 6)} material={toon('#f2a39a', { opacity: 0.5 })} position={[0.074 * s, 0.068, 0.1]} scale={[1.2, 0.6, 0.4]} />
        </group>
      ))}
      <mesh geometry={sphere(0.019, 10, 8)} material={toon(SKIN_SHADE)} position={[0, 0.083, 0.123]} scale={[0.85, 1.05, 0.9]} />
      <mesh geometry={smile} material={toon('#7a2430')} position={[0, 0.05, 0.116]} rotation={[0.15, 0, Math.PI]} />
      <mesh ref={mouthRef} geometry={sphere(0.026, 12, 8)} material={toon('#5a1420')} position={[0, 0.038, 0.112]} scale={[1, 0.05, 0.4]} />
    </group>
  )
}

/** Jacket front: shirt V, collar points, tie, and lapels wide at the shoulders tapering to the button. */
function SuitFront() {
  const g = useMemo(
    () => ({
      shirt: panel([
        [-0.075, 0.55],
        [0.075, 0.55],
        [0, 0.27],
      ]),
      collarL: panel([
        [-0.012, 0.545],
        [-0.075, 0.555],
        [-0.05, 0.49],
      ]),
      collarR: panel([
        [0.012, 0.545],
        [0.075, 0.555],
        [0.05, 0.49],
      ]),
      knot: panel([
        [-0.022, 0.535],
        [0.022, 0.535],
        [0.015, 0.505],
        [-0.015, 0.505],
      ]),
      blade: panel([
        [-0.014, 0.505],
        [0.014, 0.505],
        [0.026, 0.33],
        [0, 0.305],
        [-0.026, 0.33],
      ]),
      lapelL: panel([
        [-0.075, 0.555],
        [-0.135, 0.52],
        [-0.105, 0.43],
        [-0.004, 0.265],
        [-0.03, 0.4],
      ]),
      lapelR: panel([
        [0.075, 0.555],
        [0.135, 0.52],
        [0.105, 0.43],
        [0.004, 0.265],
        [0.03, 0.4],
      ]),
    }),
    [],
  )
  return (
    <group position={[0, 0, 0.127]}>
      <Part geo={g.shirt} mat={toon(SHIRT)} outline={0.006} />
      <Part geo={g.blade} mat={toon(TIE)} position={[0, 0, 0.012]} outline={0.006} />
      <Part geo={g.knot} mat={toon(TIE)} position={[0, 0, 0.014]} outline={0.006} />
      <Part geo={g.collarL} mat={toon(SHIRT)} position={[0, 0, 0.016]} outline={0.005} />
      <Part geo={g.collarR} mat={toon(SHIRT)} position={[0, 0, 0.016]} outline={0.005} />
      <Part geo={g.lapelL} mat={toon(SUIT_DARK)} position={[0, 0, 0.01]} outline={0.006} />
      <Part geo={g.lapelR} mat={toon(SUIT_DARK)} position={[0, 0, 0.01]} outline={0.006} />
    </group>
  )
}

export function Mayor() {
  const root = useRef<THREE.Group>(null)
  const pitchG = useRef<THREE.Group>(null)
  const hips = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  const arms = useMemo(() => ({ p: { shoulder: null, elbow: null } as ArmRefs, n: { shoulder: null, elbow: null } as ArmRefs }), [])
  const legs = useMemo(() => ({ p: { hip: null, knee: null, ankle: null } as LegRefs, n: { hip: null, knee: null, ankle: null } as LegRefs }), [])
  const look = useRef(0)

  useFrame((state, dt) => {
    const beat = beatNow()
    const p = poseAt(beat)
    const speech = useClub.getState().speech
    const talking = speech !== null
    look.current += ((talking ? 0.25 : 0) - look.current) * Math.min(1, dt * 3)

    root.current!.position.set(MAYOR_POS.x + p.x, MAYOR_POS.y, MAYOR_POS.z + p.z)
    root.current!.rotation.y = p.rot
    pitchG.current!.rotation.x = p.pitch
    hips.current!.position.y = HIP_H + p.y
    torso.current!.rotation.set(p.lean, p.twist, p.tilt)
    head.current!.rotation.set(p.head[0], p.head[1] + look.current * Math.sin(state.clock.elapsedTime * 0.7), p.head[2])

    const applyArm = (r: ArmRefs, a: Limb3, side: 1 | -1) => {
      r.shoulder!.rotation.set(-a[0], 0, a[1] * side, 'ZXY')
      r.elbow!.rotation.set(-a[2], 0, 0)
    }
    applyArm(arms.p, p.aP, 1)
    applyArm(arms.n, p.aN, -1)
    const applyLeg = (r: LegRefs, l: Leg4, side: 1 | -1) => {
      r.hip!.rotation.set(l[0], 0, l[1] * side)
      r.knee!.rotation.set(l[2], 0, 0)
      r.ankle!.rotation.set(l[3] - l[2] - l[0], 0, 0)
    }
    applyLeg(legs.p, p.lP, 1)
    applyLeg(legs.n, p.lN, -1)

    const open = talking ? 0.35 + 0.65 * Math.abs(Math.sin(state.clock.elapsedTime * 13)) : 0.05
    mouth.current!.scale.y = open

    head.current!.getWorldPosition(mayorHead)
  })

  return (
    <group ref={root} scale={MAYOR_SCALE}>
      <group ref={pitchG}>
        <group ref={hips} position={[0, HIP_H, 0]}>
          <Part geo={rbox(0.33, 0.2, 0.21, 0.07)} mat={toon(TROUSER)} position={[0, 0.0, 0]} outline={0.018} />
          <Leg side={1} refs={legs.p} />
          <Leg side={-1} refs={legs.n} />
          <group ref={torso} position={[0, 0.05, 0]}>
            <Part geo={cyl(0.215, 0.18, 0.52, 20)} mat={toon(SUIT)} position={[0, 0.27, 0]} scale={[1, 1, 0.62]} outline={0.02} />
            <SuitFront />
            {[1, -1].map((side) => (
              <Part key={side} geo={sphere(0.085, 16, 12)} mat={toon(SUIT)} scale={[1.15, 0.7, 0.85]} position={[0.2 * side, 0.5, 0]} outline={0.016} />
            ))}
            <mesh geometry={sphere(0.016, 10, 8)} material={neon('#ffd400', 2.2)} position={[-0.1, 0.47, 0.118]} />
            <mesh geometry={rbox(0.004, 0.2, 0.004, 0.001)} material={toon(SUIT_DARK)} position={[0, 0.16, 0.13]} />
            {[0.2, 0.12].map((y) => (
              <mesh key={y} geometry={sphere(0.011, 8, 6)} material={toon('#0e1640')} position={[0.012, y, 0.128]} />
            ))}
            <Part geo={cyl(0.055, 0.06, 0.1, 12)} mat={toon(SKIN)} position={[0, 0.57, 0]} outline={0.01} />
            <group ref={head} position={[0, 0.6, 0.0]}>
              <Head mouthRef={mouth} />
            </group>
            <Arm side={1} refs={arms.p} glove />
            <Arm side={-1} refs={arms.n} />
          </group>
        </group>
      </group>
    </group>
  )
}
