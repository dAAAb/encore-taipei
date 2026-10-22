import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rbox } from '@/three/geo'
import { Part } from '@/three/Part'
import { BANDS, toon } from '@/three/toon'
import { carpet, ceiling, wallpaper } from './textures'

export const ROOM = { halfW: 7, back: -6, front: 6, height: 3, corridorHalfW: 1.8, corridorEnd: 32 }

/** Shared knob the director turns: 0 = sickly flicker in the dark, 1 = bright and clean. */
export const roomLight = { level: 0, flicker: 1 }

function toonMap(map: THREE.Texture, color = '#ffffff') {
  return new THREE.MeshToonMaterial({ color, map, gradientMap: BANDS })
}

function Wall({ w, h, position, rotation, mat }: { w: number; h: number; position: [number, number, number]; rotation?: [number, number, number]; mat: THREE.Material }) {
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/**
 * Liminal Backrooms set: a long corridor of yellow wallpaper opening into an empty room with the TV.
 * Openings in the room walls lead into fog so the space reads as endless.
 */
export function Backroom() {
  const { halfW, back, front, height, corridorHalfW, corridorEnd } = ROOM
  const mats = useMemo(() => {
    const wall = toonMap(wallpaper([4, 1]))
    const wallLong = toonMap(wallpaper([12, 1]))
    const floor = toonMap(carpet([7, 7]))
    const floorLong = toonMap(carpet([2, 13]))
    const ceil = toonMap(ceiling([7, 6]))
    const ceilLong = toonMap(ceiling([2, 13]))
    const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6d8'), toneMapped: false })
    return { wall, wallLong, floor, floorLong, ceil, ceilLong, panel }
  }, [])
  const lights = useRef<THREE.PointLight[]>([])
  const hemi = useRef<THREE.HemisphereLight>(null)

  const panels = useMemo(() => {
    const out: [number, number][] = []
    for (let z = front + 1.5; z < corridorEnd; z += 3.2) out.push([0, z])
    for (const x of [-4.2, 0, 4.2]) for (const z of [-3.6, 0, 3.6]) out.push([x, z])
    return out
  }, [front, corridorEnd])

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

  const corridorLen = corridorEnd - front
  const corridorMid = (corridorEnd + front) / 2
  const doorW = 3.2

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#fff2c4', '#5a4a1c', 0.4]} />
      {[
        [0, 2.7, 1.2],
        [0, 2.7, 10],
        [0, 2.7, 19],
        [0, 2.7, 27],
        [-4, 2.7, -3],
        [4, 2.7, -3],
      ].map((p, i) => (
        <pointLight
          key={i}
          ref={(l) => {
            if (l) lights.current[i] = l
          }}
          position={p as [number, number, number]}
          color="#fff0c2"
          distance={11}
          decay={1.4}
          intensity={6}
        />
      ))}

      <Wall w={halfW * 2} h={halfW * 2} position={[0, 0, (back + front) / 2]} rotation={[-Math.PI / 2, 0, 0]} mat={mats.floor} />
      <Wall w={halfW * 2} h={front - back} position={[0, height, (back + front) / 2]} rotation={[Math.PI / 2, 0, 0]} mat={mats.ceil} />
      <Wall w={halfW * 2} h={height} position={[0, height / 2, back]} mat={mats.wall} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Wall
            w={(front - back - doorW) / 2}
            h={height}
            position={[s * halfW, height / 2, back + (front - back - doorW) / 4]}
            rotation={[0, -s * (Math.PI / 2), 0]}
            mat={mats.wall}
          />
          <Wall
            w={(front - back - doorW) / 2}
            h={height}
            position={[s * halfW, height / 2, front - (front - back - doorW) / 4]}
            rotation={[0, -s * (Math.PI / 2), 0]}
            mat={mats.wall}
          />
          <Wall w={halfW - corridorHalfW} h={height} position={[s * (corridorHalfW + halfW) / 2, height / 2, front]} rotation={[0, Math.PI, 0]} mat={mats.wall} />
          <Wall
            w={corridorLen}
            h={height}
            position={[s * corridorHalfW, height / 2, corridorMid]}
            rotation={[0, -s * (Math.PI / 2), 0]}
            mat={mats.wallLong}
          />
          <Part geo={rbox(0.5, height, 0.5, 0.03)} mat={toon('#cdb970')} position={[s * 3.6, height / 2, -2.6]} outline={0.02} />
        </group>
      ))}
      <Wall w={corridorHalfW * 2} h={corridorLen} position={[0, 0, corridorMid]} rotation={[-Math.PI / 2, 0, 0]} mat={mats.floorLong} />
      <Wall w={corridorHalfW * 2} h={corridorLen} position={[0, height, corridorMid]} rotation={[Math.PI / 2, 0, 0]} mat={mats.ceilLong} />
      <Wall w={corridorHalfW * 2} h={height} position={[0, height / 2, corridorEnd]} rotation={[0, Math.PI, 0]} mat={mats.wall} />

      {panels.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, height - 0.012, z]} rotation={[Math.PI / 2, 0, 0]} material={mats.panel}>
          <planeGeometry args={[1.2, 0.6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.003, back + 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[halfW * 2, 0.08]} />
        <meshBasicMaterial color="#8c7a3c" />
      </mesh>
    </group>
  )
}
