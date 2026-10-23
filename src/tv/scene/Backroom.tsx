import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BANDS, ink } from '@/three/toon'
import type { Layout } from './layouts'
import { carpet, ceiling, wallpaper } from './textures'

const HEIGHT = 3
const THICK = 0.18

/** Shared knob the director turns: 0 = sickly flicker in the dark, 1 = bright and clean. */
export const roomLight = { level: 0, flicker: 1 }

function hash(n: number) {
  const x = Math.sin(n * 91.7) * 43758.5453
  return x - Math.floor(x)
}

/** Toon wallpaper mapped in world space, so every wall length tiles without stretching. */
function wallMaterial() {
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', map: wallpaper([1, 1]), gradientMap: BANDS })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos; varying vec3 vWorldN;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWorldN = normalize(mat3(modelMatrix) * objectNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos; varying vec3 vWorldN;')
      .replace(
        '#include <map_fragment>',
        `vec2 wuv = abs(vWorldN.x) > 0.5 ? vWorldPos.zy : vWorldPos.xy;
        if (abs(vWorldN.y) > 0.5) wuv = vWorldPos.xz;
        diffuseColor *= texture2D(map, wuv / vec2(2.4, 3.0));`,
      )
  }
  m.customProgramCacheKey = () => 'backroom-wall'
  return m
}

/**
 * Liminal Backrooms set built from a floor plan: segmented yellow walls, square pillars, damp carpet
 * and a drop ceiling of fluorescent panels, some dead, some buzzing.
 */
export function Backroom({ layout }: { layout: Layout }) {
  const { bounds } = layout
  const w = bounds.maxX - bounds.minX
  const d = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  const mats = useMemo(
    () => ({
      wall: wallMaterial(),
      floor: new THREE.MeshToonMaterial({ map: carpet([w / 4, d / 4]), gradientMap: BANDS }),
      ceil: new THREE.MeshToonMaterial({ map: ceiling([w / 1.2, d / 1.2]), gradientMap: BANDS }),
      panel: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6d8'), toneMapped: false }),
      dead: new THREE.MeshBasicMaterial({ color: new THREE.Color('#7d7660') }),
    }),
    [w, d],
  )

  const walls = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const [x1, z1, x2, z2] of layout.walls) {
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.05) continue
      const g = new THREE.BoxGeometry(x1 === x2 ? THICK : len + THICK, HEIGHT, z1 === z2 ? THICK : len + THICK)
      g.translate((x1 + x2) / 2, HEIGHT / 2, (z1 + z2) / 2)
      parts.push(g)
    }
    for (const [x, z, s] of layout.pillars) {
      const g = new THREE.BoxGeometry(s, HEIGHT, s)
      g.translate(x, HEIGHT / 2, z)
      parts.push(g)
    }
    return mergeGeometries(parts)
  }, [layout])

  const panels = useMemo(() => {
    const live: [number, number][] = []
    const dead: [number, number][] = []
    let i = 0
    for (let x = Math.ceil(bounds.minX / 4) * 4 + 2; x < bounds.maxX; x += 4)
      for (let z = Math.ceil(bounds.minZ / 4) * 4 + 2; z < bounds.maxZ; z += 4) {
        const h = hash(i++)
        ;(h < 0.12 && Math.abs(x) > 3 ? dead : live).push([x, z])
      }
    return { live, dead }
  }, [bounds])

  const liveRef = useRef<THREE.InstancedMesh>(null)
  const deadRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const place = (mesh: THREE.InstancedMesh | null, list: [number, number][]) => {
      if (!mesh) return
      list.forEach(([x, z], k) => {
        o.position.set(x, HEIGHT - 0.012, z)
        o.rotation.set(Math.PI / 2, 0, 0)
        o.updateMatrix()
        mesh.setMatrixAt(k, o.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    place(liveRef.current, panels.live)
    place(deadRef.current, panels.dead)
  }, [panels])

  const lights = useRef<THREE.PointLight[]>([])
  const hemi = useRef<THREE.HemisphereLight>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const { level, flicker } = roomLight
    const buzz = flicker * (Math.sin(t * 47) > 0.86 || Math.sin(t * 13.3 + 1) > 0.97 ? 0.35 : 1)
    const k = (0.25 + 0.75 * level) * (1 - flicker * 0.5 + flicker * 0.5 * buzz)
    mats.panel.color.setRGB(1.6 * k + 0.2, 1.5 * k + 0.2, 1.15 * k + 0.15)
    lights.current.forEach((l, i) => {
      if (l) l.intensity = (5 + 13 * level) * (i % 3 === 1 ? buzz : 1)
    })
    if (hemi.current) hemi.current.intensity = 0.35 + 1.0 * level
  })

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#fff2c4', '#5a4a1c', 0.4]} />
      {[
        [0, 2.7, 1.2],
        [0, 2.7, 8],
        [0, 2.7, 15],
        [0, 2.7, 22],
        [0, 2.7, 29],
        [-5, 2.7, -3],
        [5, 2.7, -3],
      ].map((p, i) => (
        <pointLight
          key={i}
          ref={(l) => {
            if (l) lights.current[i] = l
          }}
          position={p as [number, number, number]}
          color="#fff0c2"
          distance={12}
          decay={1.4}
          intensity={6}
        />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={mats.floor}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, HEIGHT, cz]} material={mats.ceil}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh geometry={walls} material={mats.wall} />
      <mesh geometry={walls} material={ink(0.012)} />
      <instancedMesh ref={liveRef} args={[undefined, mats.panel, panels.live.length]} frustumCulled={false}>
        <planeGeometry args={[1.2, 0.6]} />
      </instancedMesh>
      {panels.dead.length > 0 && (
        <instancedMesh ref={deadRef} args={[undefined, mats.dead, panels.dead.length]} frustumCulled={false}>
          <planeGeometry args={[1.2, 0.6]} />
        </instancedMesh>
      )}
    </group>
  )
}
