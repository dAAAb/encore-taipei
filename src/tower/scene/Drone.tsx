import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { cyl, rbox, sphere, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'
import { rig } from './rigState'

const OFFSET = new THREE.Vector3(0, -1.5, -5.6)
/** On tall phone screens the remote covers the bottom third, so the drone flies higher in frame. */
const OFFSET_TALL = new THREE.Vector3(0, -0.55, -6.6)
const tmp = new THREE.Vector3()
const ARMS: [number, number][] = [
  [0.62, 0.48],
  [-0.62, 0.48],
  [0.62, -0.48],
  [-0.62, -0.48],
]

/**
 * The visitor's drone, flying a little ahead of and below the camera. It banks with the flight,
 * and when diving into a floor it shoots ahead into the glass and vanishes.
 */
export function Drone() {
  const { camera, size } = useThree()
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const props = useRef<(THREE.Mesh | null)[]>([])
  const lastY = useRef(0)
  const bank = useRef({ x: 0, z: 0 })

  useFrame((state, dt) => {
    const g = root.current!
    const t = state.clock.elapsedTime
    tmp.copy(size.width / size.height < 0.8 ? OFFSET_TALL : OFFSET)
    const dive = rig.dive
    if (dive > 0) tmp.z -= dive * dive * 9
    tmp.applyQuaternion(camera.quaternion).add(camera.position)
    g.position.copy(tmp)
    g.position.y += Math.sin(t * 2.1) * 0.06
    g.quaternion.copy(camera.quaternion)
    g.visible = rig.droneVisible && !rig.hideDrone && dive < 0.97
    g.scale.setScalar(1 - Math.max(0, dive - 0.6) * 1.6)

    const vy = (camera.position.y - lastY.current) / Math.max(dt, 1e-3)
    lastY.current = camera.position.y
    bank.current.x += (THREE.MathUtils.clamp(-vy * 0.012, -0.35, 0.35) + 0.12 - bank.current.x) * Math.min(1, dt * 4)
    bank.current.z += (THREE.MathUtils.clamp(rig.yawSpeed * -0.6, -0.4, 0.4) - bank.current.z) * Math.min(1, dt * 4)
    body.current!.rotation.set(bank.current.x, 0, bank.current.z + Math.sin(t * 1.3) * 0.03)
    props.current.forEach((p, i) => {
      if (p) p.rotation.y = t * (i % 2 ? -42 : 42)
    })
  })

  return (
    <group ref={root} renderOrder={10}>
      <group ref={body} scale={0.72}>
        <Part geo={rbox(0.62, 0.22, 0.9, 0.09)} mat={toon('#f4f1ea')} outline={0.02} />
        <Part geo={rbox(0.44, 0.1, 0.6, 0.05)} mat={toon('#ffd400')} position={[0, 0.14, 0]} outline={0.015} />
        <mesh geometry={rbox(0.3, 0.04, 0.12, 0.02)} material={toon('#1a1a24')} position={[0, 0.2, 0.18]} />
        {ARMS.map(([x, z], i) => (
          <group key={i}>
            <mesh geometry={rbox(Math.hypot(x, z), 0.06, 0.08, 0.02)} material={toon('#2a2834')} position={[x / 2, 0, z / 2]} rotation={[0, -Math.atan2(z, x), 0]} />
            <mesh geometry={cyl(0.07, 0.08, 0.14, 12)} material={toon('#2a2834')} position={[x, 0.06, z]} />
            <mesh geometry={torus(0.3, 0.025, Math.PI * 2, 28)} material={toon('#2a2834')} position={[x, 0.1, z]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh ref={(m) => void (props.current[i] = m)} position={[x, 0.15, z]}>
              <boxGeometry args={[0.56, 0.012, 0.06]} />
              <meshBasicMaterial color="#d7dbe6" transparent opacity={0.55} />
            </mesh>
            <mesh geometry={sphere(0.04, 8, 6)} material={neon(z > 0 ? (x > 0 ? '#59ff7a' : '#ff2a4d') : '#ffffff', 4)} position={[x, -0.05, z + (z > 0 ? 0.08 : -0.08)]} />
          </group>
        ))}
        <group position={[0, -0.2, -0.38]}>
          <Part geo={sphere(0.13, 14, 10)} mat={toon('#1a1a24')} outline={0.012} />
          <mesh geometry={cyl(0.06, 0.06, 0.04, 14)} material={neon('#6ad0ff', 2.4)} position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      </group>
    </group>
  )
}
