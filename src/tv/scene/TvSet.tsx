import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'
import type { Era } from '../montage/segments'

export const TV_POS = new THREE.Vector3(0, 0, -1.5)
export const SCREEN_Y = 0.92
/** The LCD's longer side; the short side follows the viewer's own screen aspect. */
const LCD_LONG = 1.0

export function lcdSize(aspect: number) {
  return aspect >= 1 ? { w: LCD_LONG, h: LCD_LONG / aspect } : { w: LCD_LONG * aspect, h: LCD_LONG }
}
export const LCD_FRONT_Z = 0.035

function Screen({ w, h, z, mat }: { w: number; h: number; z: number; mat: THREE.Material }) {
  return (
    <mesh position={[0, SCREEN_Y, z]} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/** 1970s wooden console on splayed legs, knobs on the right, rabbit ears on top. */
function OldTv({ screen }: { screen: THREE.Material }) {
  const wood = toon('#8a5129')
  return (
    <group>
      <Part geo={rbox(1.08, 0.8, 0.62, 0.07)} mat={wood} position={[0.13, SCREEN_Y - 0.02, -0.02]} outline={0.02} />
      <Part geo={rbox(0.74, 0.58, 0.06, 0.06)} mat={toon('#2a211b')} position={[0, SCREEN_Y, 0.28]} outline={0.015} />
      <Screen w={0.64} h={0.48} z={0.315} mat={screen} />
      <Part geo={rbox(0.24, 0.62, 0.04, 0.03)} mat={toon('#d8c79c')} position={[0.52, SCREEN_Y - 0.01, 0.29]} outline={0.012} />
      {[0.14, -0.04].map((dy) => (
        <Part key={dy} geo={cyl(0.055, 0.06, 0.05, 20)} mat={toon('#2b2420')} position={[0.52, SCREEN_Y + dy, 0.33]} rotation={[Math.PI / 2, 0, 0]} outline={0.01} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={rbox(0.16, 0.012, 0.01, 0.004)} material={toon('#5c4630')} position={[0.52, SCREEN_Y - 0.17 - i * 0.025, 0.315]} />
      ))}
      {[
        [-0.3, -0.2],
        [0.55, -0.2],
        [-0.3, 0.16],
        [0.55, 0.16],
      ].map(([x, z]) => (
        <Part
          key={`${x},${z}`}
          geo={cyl(0.022, 0.035, 0.52, 10)}
          mat={toon('#3a2414')}
          position={[x, 0.26, z]}
          rotation={[z > 0 ? 0.12 : -0.12, 0, x > 0 ? -0.12 : 0.12]}
          outline={0.01}
        />
      ))}
      <Part geo={sphere(0.07, 16, 10)} mat={toon('#2b2420')} position={[0.13, SCREEN_Y + 0.42, -0.05]} outline={0.01} />
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={cyl(0.007, 0.007, 0.7, 6)}
          material={toon('#c9c9cf')}
          position={[0.13 + s * 0.17, SCREEN_Y + 0.72, -0.05]}
          rotation={[0, 0, -s * 0.5]}
        />
      ))}
    </group>
  )
}

/** 1990s graphite CRT on a wooden stand with a VCR blinking 12:00. */
function CrtTv({ screen }: { screen: THREE.Material }) {
  return (
    <group>
      <Part geo={rbox(1.15, 0.46, 0.56, 0.04)} mat={toon('#6b4a2e')} position={[0, 0.23, -0.05]} outline={0.02} />
      <Part geo={rbox(0.62, 0.1, 0.4, 0.02)} mat={toon('#222228')} position={[0, 0.36, 0.06]} outline={0.012} />
      <mesh geometry={rbox(0.1, 0.03, 0.01, 0.005)} material={neon('#59ff7a', 1.6)} position={[0.18, 0.37, 0.265]} />
      <Part geo={rbox(0.94, 0.74, 0.14, 0.05)} mat={toon('#2e2e35')} position={[0, SCREEN_Y, 0.05]} outline={0.02} />
      <Part geo={rbox(0.72, 0.56, 0.5, 0.12)} mat={toon('#26262c')} position={[0, SCREEN_Y + 0.02, -0.25]} outline={0.02} />
      <Screen w={0.72} h={0.54} z={0.125} mat={screen} />
      <mesh geometry={sphere(0.012, 8, 6)} material={neon('#ff3b3b', 2)} position={[0.4, SCREEN_Y - 0.33, 0.125]} />
      <mesh geometry={rbox(0.24, 0.025, 0.01, 0.005)} material={toon('#9ea0aa')} position={[-0.25, SCREEN_Y - 0.33, 0.125]} />
    </group>
  )
}

/** Today's flat panel on a floor stand; its screen takes the viewer's aspect ratio. */
export function LcdTv({ screen, aspect }: { screen: THREE.Material; aspect: number }) {
  const { w, h } = lcdSize(aspect)
  const bottom = SCREEN_Y - h / 2
  return (
    <group>
      <Part geo={rbox(w + 0.035, h + 0.035, 0.045, 0.012)} mat={toon('#141418')} position={[0, SCREEN_Y, 0.01]} outline={0.008} />
      <Screen w={w} h={h} z={LCD_FRONT_Z} mat={screen} />
      <Part geo={cyl(0.025, 0.025, bottom, 12)} mat={toon('#2a2a30')} position={[0, bottom / 2, -0.03]} outline={0.008} />
      <Part geo={cyl(0.28, 0.3, 0.03, 32)} mat={toon('#2a2a30')} position={[0, 0.015, -0.03]} outline={0.01} />
      <mesh geometry={rbox(0.05, 0.008, 0.004, 0.002)} material={neon('#ffffff', 1.2)} position={[0, SCREEN_Y - h / 2 - 0.01, 0.035]} />
    </group>
  )
}

/**
 * The TV in the room. `eraRef` is read every frame; when it changes the old set pops out and the next
 * one pops in, so the hardware ages with the newsreel.
 */
export function TvSet({
  screen,
  eraRef,
  aspect,
  fallenRef,
}: {
  screen: THREE.Material
  eraRef: { current: Era }
  aspect: number
  fallenRef?: { current: number }
}) {
  const groups = useRef<Record<Era, THREE.Group | null>>({ film: null, crt: null, hd: null })
  const root = useRef<THREE.Group>(null)
  const shown = useRef<Era>(eraRef.current)
  const pop = useRef(1)
  const glow = useRef<THREE.PointLight>(null)
  const eras = useMemo(() => ['film', 'crt', 'hd'] as Era[], [])

  useFrame((_, dt) => {
    if (eraRef.current !== shown.current) {
      shown.current = eraRef.current
      pop.current = 0
    }
    pop.current = Math.min(1, pop.current + dt / 0.38)
    const p = pop.current
    const s = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.12 - (1 - p) * 0.25 : 1
    for (const e of eras) {
      const g = groups.current[e]
      if (!g) continue
      g.visible = e === shown.current
      if (g.visible) g.scale.setScalar(s)
    }
    const fall = fallenRef?.current ?? 0
    if (root.current) {
      root.current.rotation.x = -fall * (Math.PI / 2) * 0.96
      root.current.rotation.z = fall * 0.35
      root.current.position.y = fall * 0.32
    }
    if (glow.current) {
      const m = screen as THREE.ShaderMaterial
      glow.current.intensity = 2.5 * (m.uniforms?.uPower?.value ?? 0) * (1 - fall)
    }
  })

  return (
    <group position={TV_POS}>
      <group ref={root}>
        {eras.map((e) => (
          <group
            key={e}
            ref={(g) => {
              groups.current[e] = g
            }}
            visible={e === shown.current}
          >
            {e === 'film' && <OldTv screen={screen} />}
            {e === 'crt' && <CrtTv screen={screen} />}
            {e === 'hd' && <LcdTv screen={screen} aspect={aspect} />}
          </group>
        ))}
      </group>
      <pointLight ref={glow} position={[0, SCREEN_Y, 0.9]} color="#b8d4ff" distance={6} decay={1.5} intensity={0} />
    </group>
  )
}
