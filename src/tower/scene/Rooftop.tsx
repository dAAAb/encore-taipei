import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { capsule, cyl, rbox, sphere, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, SANITIZE, toon } from '@/three/toon'
import { DEPTH, WIDTH } from '../layout'
import { bulbLayout } from '../textures'
import type { ChatMessage } from '../chat'

function planks() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `hsl(28 ${38 + (i % 3) * 6}% ${30 + ((i * 7) % 9)}%)`
    g.fillRect(0, i * 16, 256, 15)
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillRect(0, i * 16 + 15, 256, 1)
    g.fillRect(((i * 97) % 200) + 20, i * 16, 1, 15)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}

/** The NYC rooftop sign: one instanced bulb per lit cell of the rasterised text, with a chase running through. */
function BulbSign() {
  const { mesh, cols, rows } = useMemo(() => {
    const { pts, cols, rows } = bulbLayout(['台北安可', '黃金十年'], 9)
    const geo = new THREE.SphereGeometry(0.082, 8, 6)
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 aCell;
        uniform float time;
        varying vec3 vCol;
        void main() {
          float line = aCell.z;
          float chase = step(0.62, fract((aCell.x * 0.08 + aCell.y * 0.05) - time * 0.55));
          float twinkle = 0.85 + 0.15 * sin(time * 9.0 + aCell.x * 3.1 + aCell.y * 1.7);
          vec3 warm = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.72, 0.18), line);
          vCol = warm * (1.6 + chase * 1.6) * twinkle;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        void main() {
          gl_FragColor = vec4(vCol, 1.0);
          ${SANITIZE}
        }
      `,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, pts.length)
    const cell = new Float32Array(pts.length * 3)
    const m = new THREE.Matrix4()
    pts.forEach(([x, y, line], i) => {
      m.makeTranslation(x * 0.17, y * 0.17, 0)
      mesh.setMatrixAt(i, m)
      cell.set([x, y, line], i * 3)
    })
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 3))
    mesh.frustumCulled = false
    return { mesh, cols, rows }
  }, [])
  useFrame((s) => {
    ;(mesh.material as THREE.ShaderMaterial).uniforms.time.value = s.clock.elapsedTime
  })
  const w = cols * 0.17
  const h = rows * 0.17
  return (
    <group position={[0, 6.6, -DEPTH / 2 + 1.2]}>
      <mesh position={[0, 0, -0.12]}>
        <planeGeometry args={[w + 0.6, h + 0.6]} />
        <meshBasicMaterial color="#0b0a10" />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`v${i}`} geometry={rbox(0.06, h + 0.8, 0.06, 0.01)} material={toon('#2a2834')} position={[-w / 2 + (i * w) / 8, 0, -0.2]} />
      ))}
      {[-h / 2 - 0.3, 0, h / 2 + 0.3].map((y) => (
        <mesh key={`h${y}`} geometry={rbox(w + 0.8, 0.07, 0.07, 0.01)} material={toon('#2a2834')} position={[0, y, -0.2]} />
      ))}
      {[-w / 2 + 0.6, w / 2 - 0.6].map((x) => (
        <Part key={x} geo={rbox(0.25, 6.6, 0.25, 0.04)} mat={toon('#1c1a24')} position={[x, -h / 2 - 3.3, -0.3]} outline={0.02} />
      ))}
      <primitive object={mesh} />
    </group>
  )
}

function WaterTower() {
  return (
    <group position={[WIDTH / 2 - 2.4, 0, -DEPTH / 2 + 2.6]}>
      {[
        [-0.9, -0.9],
        [0.9, -0.9],
        [-0.9, 0.9],
        [0.9, 0.9],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={rbox(0.14, 2.6, 0.14, 0.02)} material={toon('#2b2a30')} position={[x, 1.3, z]} />
      ))}
      <Part geo={cyl(1.35, 1.35, 2.6, 24)} mat={toon('#8a5a3a')} position={[0, 3.9, 0]} outline={0.03} />
      {[3.1, 3.9, 4.7].map((y) => (
        <mesh key={y} geometry={torus(1.37, 0.035, Math.PI * 2, 32)} material={toon('#2b2a30')} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <Part geo={cyl(0.05, 1.5, 1.1, 24)} mat={toon('#5a3a26')} position={[0, 5.75, 0]} outline={0.03} />
    </group>
  )
}

function Chair({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Part geo={rbox(0.9, 0.12, 0.85, 0.03)} mat={toon(color)} position={[0, 0.42, 0]} outline={0.02} />
      <Part geo={rbox(0.9, 0.85, 0.1, 0.03)} mat={toon(color)} position={[0, 0.82, -0.42]} rotation={[-0.32, 0, 0]} outline={0.02} />
      {[-0.4, 0.4].map((ax) => (
        <mesh key={ax} geometry={rbox(0.08, 0.42, 0.75, 0.02)} material={toon('#3a2a22')} position={[ax, 0.21, 0]} />
      ))}
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cyl(0.03, 0.03, 1.7, 8)} material={toon('#1c1a20')} position={[0, 0.85, 0]} />
      <mesh geometry={cyl(0.25, 0.25, 0.04, 16)} material={toon('#1c1a20')} position={[0, 0.02, 0]} />
      <Part geo={cyl(0.22, 0.36, 0.42, 18, true)} mat={toon('#f3e3c2', { emissive: '#ffb45e', emissiveIntensity: 0.9 })} position={[0, 1.82, 0]} outline={0.015} />
      <mesh geometry={sphere(0.12, 10, 8)} material={neon('#ffd08a', 4)} position={[0, 1.72, 0]} />
    </group>
  )
}

function Sitter({ x, z, rot, shirt, hair }: { x: number; z: number; rot: number; shirt: string; hair: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.8 + x) * 0.04
  })
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group ref={g}>
        <Part geo={capsule(0.2, 0.35)} mat={toon(shirt)} position={[0, 0.85, -0.1]} rotation={[-0.25, 0, 0]} outline={0.015} />
        <Part geo={sphere(0.17, 14, 10)} mat={toon('#f2c9a4')} position={[0, 1.33, -0.17]} outline={0.015} />
        <Part geo={sphere(0.18, 14, 10)} mat={toon(hair)} scale={[1, 0.7, 1]} position={[0, 1.42, -0.2]} outline={0.012} />
        <Part geo={capsule(0.09, 0.4)} mat={toon('#2b2f45')} position={[-0.11, 0.55, 0.22]} rotation={[Math.PI / 2, 0, 0]} outline={0.012} />
        <Part geo={capsule(0.09, 0.4)} mat={toon('#2b2f45')} position={[0.11, 0.55, 0.22]} rotation={[Math.PI / 2, 0, 0]} outline={0.012} />
      </group>
    </group>
  )
}

function Planter({ x, z, w, d, tree }: { x: number; z: number; w: number; d: number; tree?: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <Part geo={rbox(w, 0.6, d, 0.05)} mat={toon('#5a3a26')} position={[0, 0.3, 0]} outline={0.02} />
      {Array.from({ length: Math.round(w * 1.5) }, (_, i) => (
        <Part key={i} geo={sphere(0.32, 12, 8)} mat={toon(i % 2 ? '#2f7d4a' : '#3d9a57')} position={[-w / 2 + 0.35 + i * 0.66, 0.75, 0]} outline={0.015} />
      ))}
      {tree && (
        <group position={[0, 0.6, 0]}>
          <mesh geometry={cyl(0.08, 0.12, 1.6, 8)} material={toon('#4a3020')} position={[0, 0.8, 0]} />
          <Part geo={sphere(0.9, 16, 12)} mat={toon('#2f8a4e')} position={[0, 2.0, 0]} outline={0.025} />
          <Part geo={sphere(0.6, 14, 10)} mat={toon('#3fa35e')} position={[0.35, 2.45, 0.2]} outline={0.02} />
        </group>
      )}
    </group>
  )
}

/** Café string lights hanging in shallow arcs between four poles over the lounge. */
function StringLights() {
  const geo = useMemo(() => {
    const poles: [number, number][] = [
      [-6.4, 4.4],
      [6.4, 4.4],
      [6.4, -1.4],
      [-6.4, -1.4],
    ]
    const pts: number[] = []
    const runs: [[number, number], [number, number]][] = [
      [poles[0], poles[2]],
      [poles[1], poles[3]],
      [poles[0], poles[1]],
      [poles[3], poles[2]],
    ]
    for (const [a, b] of runs) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.floor(len / 0.55)
      for (let i = 1; i < n; i++) {
        const t = i / n
        const sag = 0.9 * 4 * t * (1 - t)
        pts.push(a[0] + (b[0] - a[0]) * t, 3.1 - sag, a[1] + (b[1] - a[1]) * t)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return { g, poles }
  }, [])
  return (
    <group>
      <points geometry={geo.g}>
        <pointsMaterial color={new THREE.Color(3.2, 2.4, 1.2)} size={0.22} sizeAttenuation toneMapped={false} />
      </points>
      {geo.poles.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={cyl(0.05, 0.05, 3.2, 8)} material={toon('#1c1a20')} position={[x, 1.6, z]} />
      ))}
    </group>
  )
}

const SEATS: { x: number; z: number; rot: number; color: string }[] = [
  { x: -3.4, z: 2.6, rot: 0.5, color: '#e7d9bd' },
  { x: -1.4, z: 3.4, rot: 0.1, color: '#d8e6f0' },
  { x: 1.4, z: 3.4, rot: -0.1, color: '#e7d9bd' },
  { x: 3.4, z: 2.6, rot: -0.5, color: '#d8e6f0' },
  { x: -3.6, z: -0.2, rot: Math.PI - 0.6, color: '#f0d6d6' },
  { x: 3.6, z: -0.2, rot: Math.PI + 0.6, color: '#f0d6d6' },
]

function Bubble({ msg, at, fresh }: { msg: ChatMessage; at: THREE.Vector3; fresh: boolean }) {
  return (
    <Html position={at} center distanceFactor={24} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`roof-bubble ${fresh ? 'roof-bubble--fresh' : ''}`}>
        <b>{msg.name}</b>
        {msg.body}
      </div>
    </Html>
  )
}

export function Rooftop({ y, messages, showBubbles }: { y: number; messages: ChatMessage[]; showBubbles: boolean }) {
  const deck = useMemo(() => planks(), [])
  const fire = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (fire.current) fire.current.scale.y = 1 + Math.sin(s.clock.elapsedTime * 11) * 0.12 + Math.sin(s.clock.elapsedTime * 7.3) * 0.08
  })
  const recent = messages.slice(0, SEATS.length)
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WIDTH + 0.4, DEPTH + 0.4]} />
        <meshToonMaterial map={deck} />
      </mesh>
      <mesh geometry={rbox(WIDTH + 0.7, 0.3, DEPTH + 0.7, 0.05)} material={toon('#14121c')} position={[0, -0.12, 0]} />
      {[
        { p: [0, 0.55, DEPTH / 2 + 0.2], s: [WIDTH + 0.6, 1.0, 0.04] },
        { p: [WIDTH / 2 + 0.2, 0.55, 0], s: [0.04, 1.0, DEPTH + 0.4] },
        { p: [-WIDTH / 2 - 0.2, 0.55, 0], s: [0.04, 1.0, DEPTH + 0.4] },
      ].map(({ p, s }, i) => (
        <group key={i}>
          <mesh position={p as [number, number, number]}>
            <boxGeometry args={s as [number, number, number]} />
            <meshBasicMaterial color="#9fc8ff" transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <mesh position={[p[0], 1.07, p[2]]}>
            <boxGeometry args={[Math.max(s[0], 0.07), 0.07, Math.max(s[2], 0.07)]} />
            <meshToonMaterial color="#2b2a30" />
          </mesh>
        </group>
      ))}

      <BulbSign />
      <WaterTower />
      <StringLights />

      <group position={[0, 0, 1.6]}>
        <Part geo={cyl(0.9, 0.9, 0.45, 24)} mat={toon('#3a3640')} position={[0, 0.23, 0]} outline={0.02} />
        <mesh ref={fire} geometry={cyl(0.02, 0.45, 0.5, 12)} material={neon('#ff8a2a', 3.4, 0.9)} position={[0, 0.7, 0]} />
        <mesh geometry={sphere(0.3, 10, 8)} material={neon('#ffd25a', 4)} position={[0, 0.55, 0]} />
      </group>
      {SEATS.map((s, i) => (
        <Chair key={i} {...s} />
      ))}
      <Sitter x={-3.4} z={2.6} rot={0.5 + Math.PI} shirt="#ff7a1a" hair="#1a1416" />
      <Sitter x={1.4} z={3.4} rot={-0.1 + Math.PI} shirt="#2f7bff" hair="#5a3a26" />
      <Sitter x={3.6} z={-0.2} rot={0.6} shirt="#e86a9a" hair="#c9c6cc" />
      <Lamp x={-5.2} z={3.6} />
      <Lamp x={5.2} z={3.6} />
      <Lamp x={-5.2} z={-1.6} />
      <Planter x={-5.6} z={-4.2} w={3} d={1.1} tree />
      <Planter x={0} z={-3.2} w={4.5} d={0.9} />
      <Planter x={-WIDTH / 2 + 0.8} z={1} w={1.1} d={3} />
      <Planter x={WIDTH / 2 - 0.8} z={2.2} w={1.1} d={2.6} tree />

      {showBubbles &&
        recent.map((m, i) => <Bubble key={m.id} msg={m} at={new THREE.Vector3(SEATS[i].x, 2.2 + (i % 2) * 0.5, SEATS[i].z)} fresh={i === 0} />)}
    </group>
  )
}
