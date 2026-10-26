import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sphere } from '@/three/geo'
import { BANDS, ink } from '@/three/toon'

/** Club floor footprint; the cloud banks sit on its open edges. */
export const FLOOR = { halfW: 30, back: -25, front: 21 }

type Puff = { x: number; y: number; z: number; r: number; c: THREE.Color }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** A cartoon cumulus: one fat core ringed by smaller puffs, all flattened on the underside. */
function cumulus(out: Puff[], r: () => number, x: number, y: number, z: number, size: number, tint: THREE.Color) {
  const shade = () => tint.clone().offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.08)
  out.push({ x, y, z, r: size, c: shade() })
  const n = 4 + Math.floor(r() * 4)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8
    const d = size * (0.6 + r() * 0.45)
    out.push({
      x: x + Math.cos(a) * d,
      y: y + (r() - 0.3) * size * 0.45,
      z: z + Math.sin(a) * d * 0.85,
      r: size * (0.5 + r() * 0.35),
      c: shade(),
    })
  }
}

function insideFloor(x: number, z: number, margin: number) {
  return Math.abs(x) < FLOOR.halfW + margin && z > FLOOR.back - margin && z < FLOOR.front + margin
}

function makeMaterial() {
  return new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: BANDS, emissive: '#3a0f52', emissiveIntensity: 0.55 })
}

function PuffField({ puffs, outline, sway }: { puffs: Puff[]; outline: number; sway: number }) {
  const body = useRef<THREE.InstancedMesh>(null)
  const hull = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const material = useMemo(() => makeMaterial(), [])
  const geo = sphere(1, 18, 12)

  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    puffs.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z)
      d.scale.set(p.r, p.r * 0.78, p.r)
      d.updateMatrix()
      body.current!.setMatrixAt(i, d.matrix)
      body.current!.setColorAt(i, p.c)
    })
    body.current!.instanceMatrix.needsUpdate = true
    body.current!.instanceColor!.needsUpdate = true
    hull.current!.instanceMatrix = body.current!.instanceMatrix
    body.current!.computeBoundingSphere()
    hull.current!.computeBoundingSphere()
  }, [puffs])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    group.current!.position.y = Math.sin(t * 0.35) * sway
    group.current!.rotation.y = Math.sin(t * 0.03) * 0.012
  })

  return (
    <group ref={group}>
      <instancedMesh ref={body} args={[geo, material, puffs.length]} />
      <instancedMesh ref={hull} args={[geo, ink(outline), puffs.length]} />
    </group>
  )
}

/**
 * The club floats in a sea of cloud: soft banks roll over the open floor edges and a lower
 * cumulus layer hides the drop, with the AI-park towers poking through.
 */
export function Clouds() {
  const banks = useMemo(() => {
    const r = rng(2033)
    const out: Puff[] = []
    const lilac = new THREE.Color('#c7a6ff')
    const rose = new THREE.Color('#ff9ed8')
    const pick = () => (r() < 0.6 ? lilac : rose)
    for (const side of [-1, 1]) {
      for (let z = FLOOR.back - 1; z <= FLOOR.front + 2; z += 3.4) {
        cumulus(out, r, side * (FLOOR.halfW + 0.5 + r() * 1.5), -0.6 + r() * 1.2, z + r() * 1.2, 2.0 + r() * 1.1, pick())
      }
    }
    for (let x = -FLOOR.halfW + 2; x <= FLOOR.halfW - 2; x += 4.2) {
      cumulus(out, r, x + r() * 1.5, -1.6 + r() * 1.0, FLOOR.back - 1.6 - r() * 1.2, 2.2 + r() * 1.0, pick())
    }
    return out
  }, [])

  const sea = useMemo(() => {
    const r = rng(101)
    const out: Puff[] = []
    const deep = new THREE.Color('#8a63d8')
    const glow = new THREE.Color('#e07bd0')
    let placed = 0
    while (placed < 95) {
      const x = -150 + r() * 300
      const z = 40 - r() * 230
      if (insideFloor(x, z, 6)) continue
      const far = Math.min(1, Math.hypot(x, z + 2) / 150)
      cumulus(out, r, x, -6 - far * 9 - r() * 4, z, 4 + far * 7 + r() * 3, r() < 0.7 ? deep : glow)
      placed++
    }
    return out
  }, [])

  return (
    <group>
      <PuffField puffs={banks} outline={0.03} sway={0.18} />
      <PuffField puffs={sea} outline={0.018} sway={0.5} />
    </group>
  )
}
