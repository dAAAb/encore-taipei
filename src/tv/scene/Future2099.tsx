import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ACCENT } from '@/lib/season'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { BANDS, ink, neon, SANITIZE, toon } from '@/three/toon'
import { roomLight } from './Backroom'
import type { Layout } from './layouts'
import { tiles } from './textures'

const HEIGHT = 3
const BASE_H = 0.9
const THICK = 0.16
const LIGHT = ACCENT.light
const BLUE = ACCENT.blue
const SKY = ACCENT.sky

const DAWN = { top: new THREE.Color('#252c66'), hor: new THREE.Color('#e5966a'), fog: new THREE.Color('#6a678c') }
const DAY = { top: new THREE.Color('#3f94ff'), hor: new THREE.Color('#ffe3a6'), fog: new THREE.Color('#f2e4c6') }

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)

/** Unlit colour the set dims at dawn and brightens with the room light (values above 1 bloom). */
function glowMaterial(color: string, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })
}

/** Dawn-to-morning sky that follows the camera, with the sun coming up behind the TV. */
function Sky() {
  const { scene, camera } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: DAWN.top.clone() },
          uHor: { value: DAWN.hor.clone() },
          uSun: { value: new THREE.Vector3(0.3, 0.02, -1).normalize() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHor;
          uniform vec3 uSun;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 c = mix(uHor, uTop, smoothstep(-0.04, 0.5, h));
            c = mix(c, uHor * 0.75, smoothstep(0.0, -0.25, h));
            float s = max(dot(d, uSun), 0.0);
            c += vec3(1.0, 0.86, 0.6) * pow(s, 900.0) * 3.0 + vec3(1.0, 0.72, 0.42) * pow(s, 10.0) * 0.35;
            gl_FragColor = vec4(c, 1.0);
            ${SANITIZE}
          }
        `,
      }),
    [],
  )
  useFrame(() => {
    const k = roomLight.level
    mat.uniforms.uTop.value.copy(DAWN.top).lerp(DAY.top, k)
    mat.uniforms.uHor.value.copy(DAWN.hor).lerp(DAY.hor, k)
    mat.uniforms.uSun.value.set(0.3, 0.015 + 0.2 * k, -1).normalize()
    if (scene.fog) scene.fog.color.copy(DAWN.fog).lerp(DAY.fog, k)
    if (scene.background instanceof THREE.Color) scene.background.copy(DAWN.fog).lerp(DAY.fog, k)
    mesh.current?.position.copy(camera.position)
  })
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  )
}

/** White and pale-gold towers all around, one draw call each for bodies and crowns. */
function City({ layout, count }: { layout: Layout; count: number }) {
  const { bodies, crowns } = useMemo(() => {
    const r = rand(2099)
    const palette = ['#ffffff', '#eef2f8', '#9cc4f0', '#6fa5e4', ACCENT.city, '#f4efe4', '#86b6ec'].map((c) => new THREE.Color(c))
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshToonMaterial({ gradientMap: BANDS }), count)
    const crowns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.62, 1, 4).translate(0, 0.5, 0), toon(ACCENT.crown), count)
    const o = new THREE.Object3D()
    const { minX, maxX, minZ, maxZ } = layout.bounds
    let k = 0
    let c = 0
    for (let i = 0; i < count * 4 && k < count; i++) {
      const a = r() * Math.PI * 2
      const d = 85 + Math.pow(r(), 0.7) * 260
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (x > minX - 12 && x < maxX + 12 && z > minZ - 12 && z < maxZ + 12) continue
      const w = 9 + r() * 16
      const h = 16 + Math.pow(r(), 1.6) * (d < 150 ? 55 : 140)
      o.position.set(x, 0, z)
      o.rotation.set(0, Math.round(r() * 3) * (Math.PI / 2) + (r() - 0.5) * 0.4, 0)
      o.scale.set(w, h, 8 + r() * 14)
      o.updateMatrix()
      bodies.setMatrixAt(k, o.matrix)
      bodies.setColorAt(k, palette[Math.floor(r() * palette.length)])
      if (h > 70) {
        o.position.y = h
        o.scale.set(w * 0.7, 4 + r() * 8, w * 0.7)
        o.updateMatrix()
        crowns.setMatrixAt(c++, o.matrix)
      }
      k++
    }
    bodies.count = k
    crowns.count = c
    bodies.frustumCulled = crowns.frustumCulled = false
    return { bodies, crowns }
  }, [layout, count])
  return (
    <group>
      <primitive object={bodies} />
      <primitive object={crowns} />
    </group>
  )
}

/** Taipei 101, re-dressed for 2099 in white with light rings. */
function Taipei101() {
  return (
    <group position={[95, 0, -240]} scale={0.95}>
      <Part geo={rbox(34, 60, 34, 1)} mat={toon('#eef1f6')} position={[0, 30, 0]} outline={0.4} />
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[0, 60 + i * 18, 0]}>
          <Part geo={cyl(15, 12, 18, 4)} mat={toon('#f4f6fa')} rotation={[0, Math.PI / 4, 0]} position={[0, 9, 0]} outline={0.35} />
          <mesh position={[0, 17.6, 0]} rotation={[0, Math.PI / 4, 0]} material={neon(i % 2 ? LIGHT : SKY, 1.3)}>
            <cylinderGeometry args={[15.1, 15.1, 0.5, 4, 1, true]} />
          </mesh>
        </group>
      ))}
      <Part geo={rbox(16, 14, 16, 0.6)} mat={toon('#eef1f6')} position={[0, 211, 0]} outline={0.3} />
      <mesh geometry={cyl(0.6, 1.4, 50, 8)} material={toon(ACCENT.crown)} position={[0, 243, 0]} />
    </group>
  )
}

/** A research campus on the horizon: a glass dome on a white podium with a ring of light. */
function AiCampus() {
  return (
    <group position={[-120, 0, -175]}>
      <Part geo={rbox(90, 8, 60, 1)} mat={toon('#f5f2ea')} position={[0, 4, 0]} outline={0.3} />
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#cfe8ff" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[0, 8.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={neon('#8cc4ff', 1.6)}>
        <torusGeometry args={[26.4, 0.5, 6, 64]} />
      </mesh>
      <mesh position={[0, 21, 0]} rotation={[Math.PI / 2, 0, 0]} material={neon(LIGHT, 1.4)}>
        <torusGeometry args={[19.5, 0.35, 6, 64]} />
      </mesh>
      {[-34, 34].map((x) => (
        <Part key={x} geo={rbox(14, 22, 30, 0.6)} mat={toon('#e9eef6')} position={[x, 11, 0]} outline={0.25} />
      ))}
    </group>
  )
}

function Maglev() {
  const train = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (train.current) train.current.position.x = (((s.clock.elapsedTime * 22) % 900) + 900) % 900 - 450
  })
  return (
    <group position={[0, 0, -95]}>
      <mesh geometry={rbox(900, 1.2, 3, 0.2)} material={toon('#f4f1ea')} position={[0, 14, 0]} />
      <mesh position={[0, 14.65, 1.52]} material={neon(BLUE, 1.2)}>
        <boxGeometry args={[900, 0.18, 0.05]} />
      </mesh>
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} geometry={cyl(0.7, 0.9, 14, 10)} material={toon('#e9e4d8')} position={[-435 + i * 30, 7, 0]} />
      ))}
      <group ref={train}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-i * 13, 16.4, 0]}>
            <Part geo={rbox(12.4, 2.6, 3.2, 1.1)} mat={toon('#ffffff')} outline={0.12} />
            <mesh position={[0, 0.2, 1.62]} material={neon('#8cd2ff', 1.4)}>
              <boxGeometry args={[10, 0.7, 0.05]} />
            </mesh>
            <mesh position={[0, -0.75, 1.63]} material={neon(LIGHT, 1.2)}>
              <boxGeometry args={[12, 0.16, 0.05]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function Drones({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null)
  const paths = useMemo(() => {
    const r = rand(77)
    return Array.from({ length: count }, () => ({
      cx: (r() - 0.5) * 140,
      cz: -40 - r() * 90,
      y: 14 + r() * 22,
      rad: 18 + r() * 30,
      speed: 0.08 + r() * 0.1,
      ph: r() * Math.PI * 2,
    }))
  }, [count])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    group.current?.children.forEach((d, i) => {
      const p = paths[i]
      const a = t * p.speed + p.ph
      d.position.set(p.cx + Math.cos(a) * p.rad, p.y + Math.sin(t * 1.3 + p.ph) * 0.6, p.cz + Math.sin(a) * p.rad * 0.4)
      d.rotation.y = -a
    })
  })
  return (
    <group ref={group}>
      {paths.map((_, i) => (
        <group key={i} scale={1.4}>
          <Part geo={rbox(1.4, 0.45, 1, 0.18)} mat={toon('#ffffff')} outline={0.04} />
          {[
            [-0.9, -0.7],
            [0.9, -0.7],
            [-0.9, 0.7],
            [0.9, 0.7],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.18, z]} geometry={cyl(0.5, 0.5, 0.04, 14)} material={toon('#c9d3e6')} />
          ))}
          <mesh position={[0.72, 0, 0]} geometry={sphere(0.12, 8, 6)} material={neon(i % 2 ? LIGHT : SKY, 3)} />
        </group>
      ))}
    </group>
  )
}

/** Ribbon cloth: a band of `color` with `edge` piping down both sides. */
function ribbonTexture(color: string, edge: string) {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 4
  const g = c.getContext('2d')!
  g.fillStyle = edge
  g.fillRect(0, 0, 32, 4)
  g.fillStyle = color
  g.fillRect(5, 0, 22, 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A garland ribbon strung along the corridor under the skylight, rippling and twisting a little. */
function Ribbon({ color, edge, x, y, z0, z1, phase }: { color: string; edge: string; x: number; y: number; z0: number; z1: number; phase: number }) {
  const len = z1 - z0
  const geo = useMemo(() => new THREE.PlaneGeometry(0.46, len, 1, Math.max(24, Math.round(len * 5))).rotateX(-Math.PI / 2), [len])
  const rest = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: ribbonTexture(color, edge), side: THREE.DoubleSide }), [color, edge])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const lx = rest[i * 3]
      const lz = rest[i * 3 + 2]
      const z = lz + len / 2
      const sag = -0.3 * Math.abs(Math.sin((Math.PI * z) / 4))
      const wave = Math.sin(z * 0.6 + t * 1.3 + phase) * 0.06
      const twist = lx * Math.sin(z * 0.45 + t * 0.9 + phase) * 0.6
      pos.setY(i, sag + wave + twist)
    }
    pos.needsUpdate = true
    mat.color.setScalar(0.5 + 0.5 * roomLight.level)
  })
  return <mesh geometry={geo} material={mat} position={[x, y, (z0 + z1) / 2]} />
}

/** A balloon tied to a little gold weight on the floor. */
function Balloon({ x, y, z, color, phase }: { x: number; y: number; z: number; color: string; phase: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (g.current) {
      g.current.position.y = y + Math.sin(t * 0.9 + phase) * 0.06
      g.current.rotation.z = Math.sin(t * 0.7 + phase) * 0.04
    }
  })
  const len = y - 0.36 - 0.1
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={rbox(0.14, 0.12, 0.14, 0.03)} material={toon(ACCENT.trim)} position={[0, 0.06, 0]} />
      <group ref={g} position={[0, y, 0]}>
        <Part geo={sphere(0.26, 18, 14)} mat={toon(color)} scale={[1, 1.18, 1]} outline={0.012} />
        <mesh geometry={cyl(0.03, 0.05, 0.06, 8)} material={toon(color)} position={[0, -0.33, 0]} />
        <mesh geometry={cyl(0.006, 0.006, len, 4)} material={toon('#6b6f80')} position={[0, -0.36 - len / 2, 0]} />
      </group>
    </group>
  )
}

/** Balloons drifting up past the windows, wrapping back to the ground when they leave the sky. */
function DriftingBalloons({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null)
  const items = useMemo(() => {
    const r = rand(11)
    return Array.from({ length: count }, (_, i) => ({
      x: (r() < 0.5 ? -1 : 1) * (6 + r() * 26),
      z: -30 + r() * 50,
      y0: r() * 40,
      speed: 0.5 + r() * 0.5,
      color: i % 2 ? LIGHT : BLUE,
      ph: r() * 6,
    }))
  }, [count])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    group.current?.children.forEach((b, i) => {
      const it = items[i]
      b.position.set(it.x + Math.sin(t * 0.3 + it.ph) * 1.2, 2 + ((it.y0 + t * it.speed) % 40), it.z)
    })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group key={i}>
          <Part geo={sphere(0.55, 16, 12)} mat={toon(it.color)} scale={[1, 1.18, 1]} outline={0.02} />
        </group>
      ))}
    </group>
  )
}

/** The parade airship: crosses the skyline now and then, towing a yellow and a blue streamer. */
function Airship() {
  const ship = useRef<THREE.Group>(null)
  const cloth = useMemo(() => new THREE.PlaneGeometry(26, 1.6, 24, 1), [])
  const rest = useMemo(() => Float32Array.from(cloth.attributes.position.array), [cloth])
  const geos = useMemo(() => [cloth.clone(), cloth.clone()], [cloth])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const cycle = 70
    const k = ((t + 20) % cycle) / cycle
    const g = ship.current
    if (!g) return
    g.visible = k < 0.75
    g.position.set(-200 + (k / 0.75) * 400, 34 + Math.sin(t * 0.4) * 1.5, -110)
    geos.forEach((geo, j) => {
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const bx = rest[i * 3]
        const free = (13 - bx) / 26
        pos.setZ(i, Math.sin(bx * 0.35 + t * 3 + j) * 1.2 * free)
        pos.setY(i, rest[i * 3 + 1] + Math.sin(bx * 0.25 + t * 2 + j * 2) * 0.5 * free)
      }
      pos.needsUpdate = true
    })
  })
  return (
    <group ref={ship}>
      <group scale={[11, 3.6, 3.6]}>
        <Part geo={sphere(1, 32, 20)} mat={toon(LIGHT)} outline={0.02} />
      </group>
      <mesh rotation={[0, 0, Math.PI / 2]} material={toon(BLUE)}>
        <cylinderGeometry args={[3.66, 3.66, 2.2, 32, 1, true]} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <mesh key={a} geometry={rbox(4, 0.3, 2.8, 0.1)} material={toon(BLUE)} position={[-9.5, Math.sin(a) * 2, Math.cos(a) * 2]} rotation={[a, 0, 0]} />
      ))}
      <Part geo={rbox(4.5, 1.4, 1.8, 0.4)} mat={toon('#ffffff')} position={[1, -4, 0]} outline={0.05} />
      {[LIGHT, BLUE].map((c, j) => (
        <mesh key={c} geometry={geos[j]} position={[-26 - j * 1.5, -1 - j * 2.2, 0]}>
          <meshBasicMaterial color={c} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Taipei 2099 set built on the same floor plans as the backrooms: low white walls topped with glass, light
 * pillars, a skylight lattice, pale stone floor with a yellow and blue inlay running to the TV, and the city of
 * the future outside, from dawn to full morning as the director raises the room light.
 */
export function Future2099({ layout, lowPower }: { layout: Layout; lowPower: boolean }) {
  const { scene, camera } = useThree()
  useLayoutEffect(() => {
    roomLight.haze = 12
    const cam = camera as THREE.PerspectiveCamera
    const far = cam.far
    cam.far = 900
    cam.updateProjectionMatrix()
    scene.background = DAWN.fog.clone()
    return () => {
      roomLight.haze = 1
      cam.far = far
      cam.updateProjectionMatrix()
    }
  }, [scene, camera])

  const { bounds } = layout
  const w = bounds.maxX - bounds.minX + 24
  const d = bounds.maxZ - bounds.minZ + 24
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  const floor = useMemo(() => new THREE.MeshToonMaterial({ map: tiles([w / 2.4, d / 2.4]), gradientMap: BANDS }), [w, d])
  const glass = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.2, depthWrite: false }), [])
  const inlay = useMemo(() => [glowMaterial(LIGHT), glowMaterial(BLUE)], [])
  const strips = useMemo(() => glowMaterial('#fff2d2'), [])
  const rings = useMemo(() => [glowMaterial(LIGHT), glowMaterial(SKY)], [])

  const parts = useMemo(() => {
    const base: THREE.BufferGeometry[] = []
    const panes: THREE.BufferGeometry[] = []
    const trim: THREE.BufferGeometry[] = []
    const glassH = HEIGHT - BASE_H - 0.08
    for (const [x1, z1, x2, z2] of layout.walls) {
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.05) continue
      const alongX = z1 === z2
      const mx = (x1 + x2) / 2
      const mz = (z1 + z2) / 2
      const sx = (l: number, t: number) => (alongX ? l : t)
      const sz = (l: number, t: number) => (alongX ? t : l)
      base.push(box(sx(len + THICK, THICK), BASE_H, sz(len + THICK, THICK), mx, BASE_H / 2, mz))
      panes.push(box(sx(len, 0.03), glassH, sz(len, 0.03), mx, BASE_H + glassH / 2, mz))
      trim.push(box(sx(len + THICK, THICK * 0.8), 0.08, sz(len + THICK, THICK * 0.8), mx, HEIGHT - 0.04, mz))
      const n = Math.max(1, Math.round(len / 3.2))
      for (let i = 0; i <= n; i++) {
        const f = i / n
        trim.push(box(0.06, glassH, 0.06, x1 + (x2 - x1) * f, BASE_H + glassH / 2, z1 + (z2 - z1) * f))
      }
    }
    const columns: THREE.BufferGeometry[] = []
    const ringGeos: THREE.BufferGeometry[][] = [[], []]
    layout.pillars.forEach(([x, z, s], i) => {
      columns.push(new THREE.CylinderGeometry(s * 0.42, s * 0.46, HEIGHT, 18).translate(x, HEIGHT / 2, z))
      ;[0.95, 2.05].forEach((y, j) => ringGeos[(i + j) % 2].push(new THREE.CylinderGeometry(s * 0.47, s * 0.47, 0.07, 18, 1, true).translate(x, y, z)))
    })
    const beams: THREE.BufferGeometry[] = []
    for (let x = Math.ceil(bounds.minX / 6) * 6; x <= bounds.maxX; x += 6) beams.push(box(0.1, 0.14, bounds.maxZ - bounds.minZ, x, HEIGHT + 0.07, cz))
    for (let z = Math.ceil(bounds.minZ / 6) * 6; z <= bounds.maxZ; z += 6) beams.push(box(bounds.maxX - bounds.minX, 0.14, 0.1, cx, HEIGHT + 0.07, z))
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list) : null)
    return {
      base: merge(base),
      panes: merge(panes),
      trim: merge(trim),
      columns: merge(columns),
      rings: ringGeos.map(merge),
      beams: merge(beams),
    }
  }, [layout, bounds, cx, cz])

  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  useFrame((s) => {
    const k = roomLight.level
    if (hemi.current) hemi.current.intensity = 0.45 + 1.15 * k
    if (sun.current) sun.current.intensity = 0.35 + 1.5 * k
    const glow = 0.35 + 1.25 * k
    inlay[0].color.set(LIGHT).multiplyScalar(glow)
    inlay[1].color.set(BLUE).multiplyScalar(glow * 1.2)
    rings[0].color.set(LIGHT).multiplyScalar(0.5 + 1.1 * k + Math.sin(s.clock.elapsedTime * 2) * 0.1)
    rings[1].color.set(SKY).multiplyScalar(0.5 + 1.1 * k)
    strips.color.set('#fff2d2').multiplyScalar(0.25 + 0.4 * k)
  })

  const laneEnd = bounds.maxZ - 1
  return (
    <group>
      <hemisphereLight ref={hemi} args={['#fff3dc', '#d8c9a8', 0.6]} />
      <directionalLight ref={sun} position={[14, 30, 36]} color="#ffe8bf" intensity={0.8} />
      <ambientLight intensity={0.18} />
      <Sky />
      <City layout={layout} count={lowPower ? 90 : 170} />
      <Taipei101 />
      <AiCampus />
      <Maglev />
      <Drones count={lowPower ? 3 : 6} />
      <Airship />
      <DriftingBalloons count={lowPower ? 6 : 12} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={toon('#dcd5c4')}>
        <circleGeometry args={[900, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={floor}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {[-0.34, 0.34].map((x, i) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, (laneEnd - 0.6) / 2]} material={inlay[i]}>
          <planeGeometry args={[0.1, laneEnd + 0.6]} />
        </mesh>
      ))}
      {parts.base && <mesh geometry={parts.base} material={toon('#f6f3ec')} />}
      {parts.base && <mesh geometry={parts.base} material={ink(0.012)} />}
      {parts.panes && <mesh geometry={parts.panes} material={glass} />}
      {parts.trim && <mesh geometry={parts.trim} material={toon(ACCENT.trim)} />}
      {parts.columns && <mesh geometry={parts.columns} material={toon('#fbfaf6')} />}
      {parts.columns && <mesh geometry={parts.columns} material={ink(0.012)} />}
      {parts.rings.map((g, i) => g && <mesh key={i} geometry={g} material={rings[i]} />)}
      {parts.beams && <mesh geometry={parts.beams} material={toon('#fbfaf6', { emissive: '#fff4dc', emissiveIntensity: 0.45 })} />}
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, HEIGHT - 0.005, (laneEnd - 4) / 2]} rotation={[Math.PI / 2, 0, 0]} material={strips}>
          <planeGeometry args={[0.08, laneEnd + 4]} />
        </mesh>
      ))}

      <Ribbon color={LIGHT} edge={SKY} x={-1.05} y={2.88} z0={-3} z1={Math.min(laneEnd, 15)} phase={0} />
      <Ribbon color={BLUE} edge="#ffffff" x={1.05} y={2.88} z0={-3} z1={Math.min(laneEnd, 15)} phase={1.7} />
      <Balloon x={-2.35} y={2.35} z={-1.1} color={LIGHT} phase={0} />
      <Balloon x={-2.05} y={2.7} z={-1.7} color={BLUE} phase={1.3} />
      <Balloon x={-2.6} y={2.05} z={-1.6} color={BLUE} phase={2.1} />
      <Balloon x={2.35} y={2.35} z={-1.1} color={BLUE} phase={0.6} />
      <Balloon x={2.05} y={2.7} z={-1.7} color={LIGHT} phase={1.9} />
      <Balloon x={2.6} y={2.05} z={-1.6} color={LIGHT} phase={2.7} />
    </group>
  )
}
