import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { beatNow } from '@/audio/beat'
import { engine } from '@/audio/synth'
import { useClub } from '@/lib/store'
import { cyl, limb, rbox, sphere, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'
import { poseAt, type Leg4, type Limb3 } from './Mayor'
import { STAGE_H } from './Stage'
import { lineup, type AnimalLook, type CitizenLook, type Look } from './troupe-looks'

/** Backup line: an arc behind the mayor, inner pair first. */
const SLOTS: [number, number][] = [
  [-2.1, -10.0],
  [2.1, -10.0],
  [-3.9, -10.6],
  [3.9, -10.6],
  [-5.3, -11.5],
  [5.3, -11.5],
]

interface Dims {
  hip: number
  hipW: number
  thigh: number
  shin: number
  shoulderX: number
  shoulderY: number
  upper: number
  fore: number
  headY: number
  scale: number
  bounce: number
}

const CHIBI: Dims = { hip: 0.46, hipW: 0.09, thigh: 0.19, shin: 0.18, shoulderX: 0.19, shoulderY: 0.3, upper: 0.15, fore: 0.13, headY: 0.36, scale: 2.15, bounce: 0.6 }
const PERSON: Dims = { hip: 0.78, hipW: 0.09, thigh: 0.33, shin: 0.33, shoulderX: 0.22, shoulderY: 0.44, upper: 0.23, fore: 0.2, headY: 0.52, scale: 1.8, bounce: 1 }

interface Rig {
  root: THREE.Group | null
  pitch: THREE.Group | null
  hips: THREE.Group | null
  torso: THREE.Group | null
  head: THREE.Group | null
  arms: { shoulder: THREE.Group | null; elbow: THREE.Group | null }[]
  legs: { hip: THREE.Group | null; knee: THREE.Group | null; ankle: THREE.Group | null }[]
}

const newRig = (): Rig => ({
  root: null,
  pitch: null,
  hips: null,
  torso: null,
  head: null,
  arms: [
    { shoulder: null, elbow: null },
    { shoulder: null, elbow: null },
  ],
  legs: [
    { hip: null, knee: null, ankle: null },
    { hip: null, knee: null, ankle: null },
  ],
})

function Eyes({ y, z, spread, r, white }: { y: number; z: number; spread: number; r: number; white?: boolean }) {
  return (
    <>
      {[1, -1].map((s) => (
        <group key={s} position={[spread * s, y, z]}>
          {white && <mesh geometry={sphere(r * 1.15, 12, 8)} material={toon('#fbfaf6')} scale={[1, 1, 0.5]} />}
          <mesh geometry={sphere(r * (white ? 0.7 : 1), 12, 8)} material={toon('#17111a')} position={[0, 0, white ? r * 0.35 : 0]} scale={[0.9, 1.05, 0.6]} />
          <mesh geometry={sphere(r * 0.32, 8, 6)} material={neon('#ffffff', 1.3)} position={[r * 0.3 * s, r * 0.35, r * 0.6]} />
        </group>
      ))}
    </>
  )
}

function AnimalHead({ look }: { look: AnimalLook }) {
  const head = look.head ?? look.fur
  const ear = look.earColor ?? look.fur
  const masked = !!look.mask
  return (
    <group>
      <Part geo={sphere(0.21, 24, 18)} mat={toon(head)} scale={[1, 0.92, 0.95]} position={[0, 0.18, 0]} outline={0.016} />
      {look.ears === 'cat' &&
        [1, -1].map((s) => (
          <group key={s} position={[0.12 * s, 0.35, 0]} rotation={[0, 0, -0.35 * s]}>
            <Part geo={cyl(0.001, 0.075, 0.13, 4)} mat={toon(ear)} rotation={[0, Math.PI / 4, 0]} outline={0.01} />
            <mesh geometry={cyl(0.001, 0.045, 0.08, 4)} material={toon(look.inner ?? '#ffb3b8')} position={[0, -0.01, 0.025]} rotation={[0, Math.PI / 4, 0]} />
          </group>
        ))}
      {look.ears === 'shiba' &&
        [1, -1].map((s) => (
          <group key={s} position={[0.115 * s, 0.34, 0.02]} rotation={[0.15, 0, -0.28 * s]}>
            <Part geo={cyl(0.001, 0.085, 0.14, 4)} mat={toon(ear)} rotation={[0, Math.PI / 4, 0]} outline={0.01} />
            <mesh geometry={cyl(0.001, 0.05, 0.09, 4)} material={toon(look.inner ?? '#fff6ea')} position={[0, -0.01, 0.028]} rotation={[0, Math.PI / 4, 0]} />
          </group>
        ))}
      {look.ears === 'round' &&
        [1, -1].map((s) => (
          <Part key={s} geo={sphere(0.07, 14, 10)} mat={toon(ear)} position={[0.15 * s, 0.33, -0.02]} scale={[1, 1, 0.6]} outline={0.01} />
        ))}
      {look.ears === 'deer' &&
        [1, -1].map((s) => (
          <group key={s}>
            <Part geo={sphere(0.06, 12, 8)} mat={toon(ear)} position={[0.21 * s, 0.27, 0]} rotation={[0, 0, -0.45 * s]} scale={[1.7, 0.7, 0.5]} outline={0.01} />
            {look.antlers && (
              <group position={[0.07 * s, 0.35, -0.02]} rotation={[0, 0, -0.3 * s]}>
                <mesh geometry={cyl(0.012, 0.016, 0.14, 6)} material={toon('#d9c49a')} position={[0, 0.07, 0]} />
                <mesh geometry={cyl(0.01, 0.012, 0.07, 6)} material={toon('#d9c49a')} position={[0.025 * s, 0.1, 0]} rotation={[0, 0, -0.8 * s]} />
              </group>
            )}
          </group>
        ))}
      {look.ears === 'rabbit' &&
        [1, -1].map((s) => (
          <group key={s} position={[0.07 * s, 0.46, -0.02]} rotation={[0, 0, -0.12 * s]}>
            <Part geo={new THREE.CapsuleGeometry(0.045, 0.22, 4, 10)} mat={toon(ear)} outline={0.01} />
            <mesh geometry={new THREE.CapsuleGeometry(0.022, 0.18, 4, 8)} material={toon(look.inner ?? '#ffc2cc')} position={[0, 0, 0.03]} />
          </group>
        ))}
      {look.mask === 'panda' &&
        [1, -1].map((s) => (
          <mesh key={s} geometry={sphere(0.055, 12, 8)} material={toon('#1b1a1f')} position={[0.075 * s, 0.19, 0.16]} rotation={[0, 0, 0.55 * s]} scale={[0.9, 1.3, 0.45]} />
        ))}
      {look.mask === 'raccoon' && <mesh geometry={sphere(0.2, 20, 12)} material={toon('#2a2830')} position={[0, 0.2, 0.025]} scale={[1.04, 0.24, 0.92]} />}
      <Eyes y={0.2} z={0.18} spread={0.075} r={0.028} white={masked} />
      <mesh geometry={sphere(0.085, 14, 10)} material={toon(look.muzzle)} position={[0, 0.115, 0.165]} scale={[1.2, 0.78, 0.75]} />
      <mesh geometry={sphere(0.026, 10, 8)} material={toon(look.nose)} position={[0, 0.145, 0.23]} scale={[1.2, 0.8, 0.8]} />
      <mesh geometry={torus(0.022, 0.006, Math.PI, 12)} material={toon('#3a1a20')} position={[0, 0.105, 0.225]} rotation={[0.2, 0, Math.PI]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={sphere(0.026, 8, 6)} material={toon('#ff9fb0', { opacity: 0.55 })} position={[0.13 * s, 0.13, 0.15]} scale={[1.2, 0.6, 0.4]} />
      ))}
      {look.marks === 'leopardSpots' &&
        [
          [-0.04, 0.33],
          [0.04, 0.33],
          [0, 0.36],
        ].map(([x, y], i) => <mesh key={i} geometry={rbox(0.018, 0.06, 0.01, 0.005)} material={toon('#5a3a22')} position={[x, y, 0.15]} rotation={[-0.6, 0, 0]} />)}
    </group>
  )
}

function Tail({ look }: { look: AnimalLook }) {
  const c = look.tailColor ?? look.fur
  switch (look.tail) {
    case 'cat':
      return (
        <group position={[0, 0.02, -0.15]} rotation={[-0.85, 0, 0]}>
          <Part geo={limb(0.032, 0.3)} mat={toon(c)} rotation={[Math.PI, 0, 0]} outline={0.01} />
          {look.id === 'leopard-cat' && <mesh geometry={sphere(0.034, 8, 6)} material={toon('#3a2618')} position={[0, 0.3, 0]} />}
        </group>
      )
    case 'curl':
      return <Part geo={torus(0.07, 0.032, Math.PI * 1.6, 16)} mat={toon(c)} position={[0, 0.12, -0.17]} rotation={[0, Math.PI / 2, 0.4]} outline={0.01} />
    case 'puff':
      return <Part geo={sphere(0.06, 12, 8)} mat={toon(c)} position={[0, 0.04, -0.17]} outline={0.01} />
    case 'ringed':
      return (
        <group position={[0, 0.02, -0.15]} rotation={[-1.0, 0, 0]}>
          <Part geo={limb(0.048, 0.3)} mat={toon(c)} rotation={[Math.PI, 0, 0]} outline={0.01} />
          {[0.08, 0.16, 0.24].map((y) => (
            <mesh key={y} geometry={torus(0.05, 0.016, Math.PI * 2, 16)} material={toon('#2a2830')} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      )
    case 'stub':
      return <mesh geometry={sphere(0.045, 10, 8)} material={toon(c)} position={[0, 0.03, -0.17]} />
    default:
      return null
  }
}

function HumanHead({ look }: { look: CitizenLook }) {
  const h = look.hairColor
  return (
    <group>
      <Part geo={sphere(0.12, 22, 16)} mat={toon(look.skin)} scale={[0.92, 1.05, 0.95]} position={[0, 0.11, 0]} outline={0.014} />
      {(look.hair === 'short' || look.hair === 'band' || look.hair === 'cap') && (
        <Part geo={sphere(0.125, 20, 14)} mat={toon(h)} scale={[0.96, 0.72, 0.98]} position={[0, 0.16, -0.015]} outline={0.012} />
      )}
      {look.hair === 'bob' && <Part geo={sphere(0.135, 20, 14)} mat={toon(h)} scale={[1.05, 0.95, 0.92]} position={[0, 0.125, -0.035]} outline={0.012} />}
      {(look.hair === 'bun' || look.hair === 'nurse') && (
        <>
          <Part geo={sphere(0.125, 20, 14)} mat={toon(h)} scale={[0.96, 0.75, 0.98]} position={[0, 0.16, -0.02]} outline={0.012} />
          <Part geo={sphere(0.05, 12, 8)} mat={toon(h)} position={[0, 0.2, -0.11]} outline={0.01} />
        </>
      )}
      {look.hair === 'perm' &&
        Array.from({ length: 11 }, (_, i) => {
          const a = (i / 11) * Math.PI * 2
          return <Part key={i} geo={sphere(0.05, 10, 8)} mat={toon(h)} position={[Math.cos(a) * 0.085, 0.2 + Math.sin(a * 2) * 0.012, Math.sin(a) * 0.07 - 0.03]} outline={0.008} />
        })}
      {look.hair === 'cap' && (
        <group position={[0, 0.19, 0]}>
          <Part geo={sphere(0.128, 20, 12)} mat={toon('#2f6bd9')} scale={[1, 0.62, 1]} outline={0.012} />
          <mesh geometry={rbox(0.14, 0.015, 0.1, 0.006)} material={toon('#2f6bd9')} position={[0, -0.03, 0.13]} />
        </group>
      )}
      {look.hair === 'helmet' && (
        <group position={[0, 0.15, -0.005]}>
          <Part geo={sphere(0.145, 20, 14)} mat={toon(h)} scale={[1, 0.85, 1.05]} outline={0.014} />
          <mesh geometry={rbox(0.2, 0.03, 0.02, 0.008)} material={toon('#2d2f38')} position={[0, 0.0, 0.14]} />
        </group>
      )}
      {look.hair === 'chef' && (
        <group position={[0, 0.2, 0]}>
          <Part geo={cyl(0.1, 0.1, 0.14, 18)} mat={toon('#ffffff')} position={[0, 0.06, 0]} outline={0.01} />
          <Part geo={sphere(0.12, 16, 12)} mat={toon('#ffffff')} position={[0, 0.16, 0]} scale={[1, 0.65, 1]} outline={0.01} />
        </group>
      )}
      {look.hair === 'nurse' && <mesh geometry={rbox(0.12, 0.045, 0.06, 0.01)} material={toon('#ffffff')} position={[0, 0.235, 0.03]} />}
      {look.hair === 'band' && <mesh geometry={torus(0.115, 0.014, Math.PI * 2, 24)} material={toon('#ffffff')} position={[0, 0.17, 0]} rotation={[Math.PI / 2 - 0.15, 0, 0]} />}
      <Eyes y={0.115} z={0.105} spread={0.042} r={0.015} />
      <mesh geometry={torus(0.026, 0.006, Math.PI, 12)} material={toon('#7a2430')} position={[0, 0.06, 0.108]} rotation={[0.15, 0, Math.PI]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={sphere(0.017, 8, 6)} material={toon('#f2a39a', { opacity: 0.5 })} position={[0.068 * s, 0.075, 0.096]} scale={[1.2, 0.6, 0.4]} />
      ))}
    </group>
  )
}

function Dancer({ look, rig, dims }: { look: Look; rig: Rig; dims: Dims }) {
  const animal = look.kind === 'animal'
  const body = animal ? look.fur : look.top
  const limbsC = animal ? (look.limbs ?? look.fur) : look.top
  const legC = animal ? (look.limbs ?? look.fur) : look.bottom
  const paw = animal ? (look.limbs ?? look.belly) : look.skin
  const foot = animal ? (look.limbs ?? look.belly) : look.shoes
  return (
    <group ref={(g) => void (rig.root = g)} scale={dims.scale}>
      <group ref={(g) => void (rig.pitch = g)}>
        <group ref={(g) => void (rig.hips = g)} position={[0, dims.hip, 0]}>
          <Part geo={rbox(animal ? 0.3 : 0.3, 0.16, 0.22, 0.07)} mat={toon(animal ? body : look.bottom)} outline={0.016} />
          {!animal && look.skirt && <Part geo={cyl(0.17, 0.27, 0.24, 20)} mat={toon(look.bottom)} position={[0, -0.1, 0]} outline={0.014} />}
          {animal && <Tail look={look} />}
          {[1, -1].map((side, i) => (
            <group key={side} ref={(g) => void (rig.legs[i].hip = g)} position={[dims.hipW * side, 0, 0]}>
              <Part geo={limb(animal ? 0.07 : 0.07, dims.thigh)} mat={toon(!animal && look.skirt ? look.skin : legC)} outline={0.014} />
              <group ref={(g) => void (rig.legs[i].knee = g)} position={[0, -dims.thigh, 0]}>
                <Part geo={limb(animal ? 0.062 : 0.06, dims.shin)} mat={toon(!animal && look.skirt ? look.skin : legC)} outline={0.014} />
                <group ref={(g) => void (rig.legs[i].ankle = g)} position={[0, -dims.shin - 0.03, 0]}>
                  {animal ? (
                    <Part geo={sphere(0.07, 12, 8)} mat={toon(foot)} scale={[1, 0.6, 1.3]} position={[0, -0.01, 0.03]} outline={0.012} />
                  ) : (
                    <Part geo={rbox(0.11, 0.075, 0.24, 0.035)} mat={toon(foot)} position={[0, -0.03, 0.05]} outline={0.014} />
                  )}
                </group>
              </group>
            </group>
          ))}
          <group ref={(g) => void (rig.torso = g)} position={[0, 0.04, 0]}>
            {animal ? (
              <>
                <Part geo={cyl(0.17, 0.2, 0.34, 18)} mat={toon(body)} position={[0, 0.17, 0]} scale={[1, 1, 0.85]} outline={0.016} />
                <mesh geometry={sphere(0.14, 14, 10)} material={toon(look.belly)} position={[0, 0.15, 0.1]} scale={[0.95, 1.15, 0.55]} />
                {look.marks === 'chestV' &&
                  [1, -1].map((s) => (
                    <mesh key={s} geometry={rbox(0.03, 0.13, 0.012, 0.006)} material={toon('#f5efd8')} position={[0.04 * s, 0.25, 0.155]} rotation={[0, 0, 0.6 * s]} />
                  ))}
                {look.marks === 'pandaBand' && <Part geo={cyl(0.175, 0.185, 0.1, 18)} mat={toon('#1b1a1f')} position={[0, 0.3, 0]} scale={[1, 1, 0.87]} outline={0.01} />}
                {look.marks === 'deerSpots' &&
                  [
                    [0.13, 0.22, 0.06],
                    [-0.13, 0.25, 0.05],
                    [0.15, 0.12, 0.0],
                    [-0.15, 0.14, -0.02],
                    [0.06, 0.28, -0.12],
                    [-0.07, 0.18, -0.14],
                  ].map(([x, y, z], k) => <mesh key={k} geometry={sphere(0.022, 8, 6)} material={toon('#fff8ea')} position={[x, y, z]} scale={[1, 1, 0.5]} />)}
                {look.marks === 'leopardSpots' &&
                  [
                    [0.14, 0.2, 0.05],
                    [-0.14, 0.22, 0.04],
                    [0.12, 0.1, -0.06],
                    [-0.1, 0.27, -0.1],
                    [0.04, 0.24, -0.15],
                  ].map(([x, y, z], k) => <mesh key={k} geometry={sphere(0.024, 8, 6)} material={toon('#5a3a22')} position={[x, y, z]} scale={[1, 1, 0.5]} />)}
              </>
            ) : (
              <>
                <Part geo={cyl(0.2, 0.17, 0.46, 18)} mat={toon(look.top)} position={[0, 0.23, 0]} scale={[1, 1, 0.66]} outline={0.016} />
                {look.id === 'office' && <mesh geometry={rbox(0.045, 0.22, 0.02, 0.008)} material={toon(look.accent ?? '#d64545')} position={[0, 0.33, 0.125]} />}
                {look.id === 'student' && <mesh geometry={sphere(0.035, 10, 8)} material={toon(look.accent ?? '#1f2d5c')} position={[0, 0.42, 0.115]} scale={[1.6, 0.8, 0.6]} />}
                {look.id === 'rider' && <mesh geometry={rbox(0.36, 0.035, 0.27, 0.01)} material={neon('#d8ff5a', 1.6)} position={[0, 0.25, 0]} />}
                {look.id === 'chef' && <mesh geometry={torus(0.07, 0.022, Math.PI * 2, 16)} material={toon('#d64545')} position={[0, 0.45, 0.04]} rotation={[Math.PI / 2, 0, 0]} />}
                {look.id === 'grandma' &&
                  [-0.06, 0, 0.06].map((x) => <mesh key={x} geometry={sphere(0.014, 8, 6)} material={toon('#ffd400')} position={[x, 0.41 - Math.abs(x) * 0.6, 0.125]} />)}
                {look.id === 'baller' && <mesh geometry={rbox(0.12, 0.12, 0.01, 0.01)} material={toon('#ffffff')} position={[0, 0.25, 0.135]} />}
                <Part geo={cyl(0.05, 0.055, 0.08, 10)} mat={toon(look.skin)} position={[0, 0.49, 0]} outline={0.008} />
              </>
            )}
            <group ref={(g) => void (rig.head = g)} position={[0, dims.headY, 0]}>
              {animal ? <AnimalHead look={look} /> : <HumanHead look={look} />}
            </group>
            {[1, -1].map((side, i) => (
              <group key={side} ref={(g) => void (rig.arms[i].shoulder = g)} position={[dims.shoulderX * side, dims.shoulderY, 0]}>
                <Part geo={limb(animal ? 0.055 : 0.055, dims.upper)} mat={toon(limbsC)} outline={0.014} />
                <group ref={(g) => void (rig.arms[i].elbow = g)} position={[0, -dims.upper, 0]}>
                  <Part geo={limb(animal ? 0.05 : 0.05, dims.fore)} mat={toon(animal ? limbsC : look.skin)} outline={0.014} />
                  <Part geo={sphere(animal ? 0.058 : 0.05, 12, 8)} mat={toon(paw)} position={[0, -dims.fore - 0.03, 0]} outline={0.01} />
                  {i === 0 && <mesh geometry={cyl(0.02, 0.02, 0.22, 6)} material={neon(['#ff2a4d', '#2ef2ff', '#ffd400', '#59ff7a'][Math.abs(look.id.length) % 4], 2.6)} position={[0, -dims.fore - 0.1, 0.04]} rotation={[0.4, 0, 0]} />}
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

const backOut = (t: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

/**
 * The backup line. Everyone runs the mayor's routine on the same beat; switching sends a new batch
 * popping up through the stage one after another, in a new order.
 */
export function Troupe() {
  const mode = useClub((s) => s.troupeMode)
  const seed = useClub((s) => s.troupeSeed)
  const cast = useMemo(() => lineup(mode, seed), [mode, seed])
  const rigs = useMemo(() => cast.map(() => newRig()), [cast])
  const born = useRef(0)

  useEffect(() => {
    born.current = performance.now() / 1000
    if (cast.length && useClub.getState().started) engine.scream(0.8)
  }, [cast])

  useFrame(() => {
    if (!cast.length) return
    const p = poseAt(beatNow())
    const now = performance.now() / 1000
    rigs.forEach((rig, i) => {
      if (!rig.root) return
      const dims = cast[i].kind === 'animal' ? CHIBI : PERSON
      const [sx, sz] = SLOTS[i]
      const t = Math.min(1, Math.max(0, (now - born.current - i * 0.14) / 0.55))
      const k = t <= 0 ? 0 : backOut(t)
      rig.root.visible = t > 0
      rig.root.position.set(sx + p.x * 0.8, STAGE_H + (1 - Math.min(1, t * 1.4)) * -1.6, sz + p.z * 0.8)
      rig.root.scale.setScalar(dims.scale * Math.max(0.001, k))
      rig.root.rotation.y = p.rot
      rig.pitch!.rotation.x = p.pitch
      rig.hips!.position.y = dims.hip + p.y * dims.bounce
      rig.torso!.rotation.set(p.lean, p.twist, p.tilt)
      rig.head!.rotation.set(p.head[0], p.head[1], p.head[2])
      const arm = (r: Rig['arms'][number], a: Limb3, side: 1 | -1) => {
        r.shoulder!.rotation.set(-a[0], 0, a[1] * side, 'ZXY')
        r.elbow!.rotation.set(-a[2], 0, 0)
      }
      arm(rig.arms[0], p.aP, 1)
      arm(rig.arms[1], p.aN, -1)
      const leg = (r: Rig['legs'][number], l: Leg4, side: 1 | -1) => {
        r.hip!.rotation.set(l[0], 0, l[1] * side)
        r.knee!.rotation.set(l[2], 0, 0)
        r.ankle!.rotation.set(l[3] - l[2] - l[0], 0, 0)
      }
      leg(rig.legs[0], p.lP, 1)
      leg(rig.legs[1], p.lN, -1)
    })
  })

  return (
    <group>
      {cast.map((look, i) => (
        <Dancer key={`${seed}-${look.id}`} look={look} rig={rigs[i]} dims={look.kind === 'animal' ? CHIBI : PERSON} />
      ))}
    </group>
  )
}
