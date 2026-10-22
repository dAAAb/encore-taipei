import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { ink, neon, SANITIZE, toon } from '@/three/toon'

/** Stage deck height; the TV stands on it. */
export const DECK = 1.2

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function NightSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 horizon = vec3(0.32, 0.12, 0.34);
            vec3 mid = vec3(0.06, 0.07, 0.2);
            vec3 top = vec3(0.01, 0.015, 0.05);
            vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
            col = mix(col, top, smoothstep(0.18, 0.7, h));
            gl_FragColor = vec4(col, 1.0);
            ${SANITIZE}
          }`,
      }),
    [],
  )
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  )
}

/** 大安森林公園露天音樂台: the white shell arching over the stage, ribbed like a space frame. */
function Amphitheater() {
  const shell = useMemo(() => new THREE.SphereGeometry(1, 48, 20, Math.PI, Math.PI, 0, Math.PI / 2), [])
  const S = new THREE.Vector3(11, 8.5, 7.5)
  const ribs = useMemo(() => {
    const out: THREE.TubeGeometry[] = []
    for (let i = 0; i <= 8; i++) {
      const phi = Math.PI + (i / 8) * Math.PI
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 16; k++) {
        const th = (k / 16) * (Math.PI / 2)
        pts.push(new THREE.Vector3(-Math.cos(phi) * Math.sin(th) * S.x, Math.cos(th) * S.y, Math.sin(phi) * Math.sin(th) * S.z).multiplyScalar(1.004))
      }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6))
    }
    return out
  }, [S.x, S.y, S.z])
  const shellMat = useMemo(() => {
    const m = toon('#efece4').clone()
    m.side = THREE.DoubleSide
    return m
  }, [])
  return (
    <group position={[0, DECK, -3.2]}>
      <mesh geometry={shell} material={shellMat} scale={S} />
      {ribs.map((g, i) => (
        <mesh key={i} geometry={g} material={toon('#9da0aa')} />
      ))}
      <mesh geometry={new THREE.TorusGeometry(1, 0.012, 6, 64, Math.PI)} material={toon('#9da0aa')} scale={[S.x, S.z, 1]} rotation={[Math.PI / 2, 0, Math.PI]} />
    </group>
  )
}

function Stage() {
  return (
    <group>
      <Part geo={rbox(18, DECK, 9, 0.08)} mat={toon('#3a3542')} position={[0, DECK / 2, -2.5]} outline={0.04} />
      <Part geo={rbox(6, 0.4, 1.2, 0.05)} mat={toon('#4a4552')} position={[0, 0.2, 2.6]} outline={0.03} />
      <mesh geometry={rbox(18, 0.06, 0.06, 0.02)} material={neon('#ffd400', 2.4)} position={[0, DECK + 0.01, 2.0]} />
      {[-7.5, 7.5].map((x) => (
        <group key={x} position={[x, 0, 1.5]}>
          <Part geo={cyl(0.12, 0.12, 9, 10)} mat={toon('#2a2a30')} position={[0, 4.5, 0]} outline={0.02} />
          <mesh geometry={sphere(0.32, 12, 8)} material={neon('#fff4d6', 3)} position={[0, 9.1, 0]} />
        </group>
      ))}
      <Part geo={rbox(15.4, 0.3, 0.3, 0.04)} mat={toon('#2a2a30')} position={[0, 8.8, 1.5]} outline={0.02} />
    </group>
  )
}

function Trees() {
  const crowns = useRef<THREE.InstancedMesh>(null)
  const crownInk = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = rng(7)
    const out: { x: number; z: number; s: number; c: string }[] = []
    const greens = ['#2f6b3a', '#3d7f44', '#27593a', '#4a8c4c', '#1f4d33']
    while (out.length < 260) {
      const a = r() * Math.PI * 2
      const d = 30 + r() * 110
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d - 6
      if (z > 18 && Math.abs(x) < 26) continue
      out.push({ x, z, s: 2.4 + r() * 2.6, c: greens[Math.floor(r() * greens.length)] })
    }
    return out
  }, [])
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((t, i) => {
      d.position.set(t.x, t.s * 1.6, t.z)
      d.scale.set(t.s, t.s * 1.15, t.s)
      d.rotation.set(0, i, 0)
      d.updateMatrix()
      crowns.current!.setMatrixAt(i, d.matrix)
      crowns.current!.setColorAt(i, c.set(t.c))
      d.position.set(t.x, t.s * 0.45, t.z)
      d.scale.set(t.s * 0.13, t.s * 0.9, t.s * 0.13)
      d.updateMatrix()
      trunks.current!.setMatrixAt(i, d.matrix)
    })
    crowns.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceColor!.needsUpdate = true
    trunks.current!.instanceMatrix.needsUpdate = true
    crownInk.current!.instanceMatrix = crowns.current!.instanceMatrix
  }, [list])
  const crownMat = useMemo(() => toon('#ffffff').clone(), [])
  return (
    <group>
      <instancedMesh ref={crowns} args={[geo, crownMat, list.length]} frustumCulled={false} />
      <instancedMesh ref={crownInk} args={[geo, ink(0.03), list.length]} frustumCulled={false} />
      <instancedMesh ref={trunks} args={[cyl(1, 1, 1, 8), toon('#4a3222'), list.length]} frustumCulled={false} />
    </group>
  )
}

function Audience() {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const sticks = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = rng(19)
    const out: { x: number; z: number; h: number }[] = []
    for (let row = 0; row < 14; row++) {
      const z = 5 + row * 1.5
      const half = 8 + row * 1.2
      for (let x = -half; x <= half; x += 1.05 + r() * 0.3) out.push({ x: x + r() * 0.4, z: z + r() * 0.5, h: 1.5 + r() * 0.35 })
    }
    return out
  }, [])
  const colors = ['#ff2a4d', '#2ef2ff', '#ffd400', '#ffffff']
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((p, i) => {
      d.position.set(p.x, p.h / 2, p.z)
      d.scale.set(1, p.h / 1.6, 1)
      d.updateMatrix()
      bodies.current!.setMatrixAt(i, d.matrix)
      d.position.set(p.x + 0.25, p.h + 0.35, p.z)
      d.scale.set(1, 1, 1)
      d.updateMatrix()
      sticks.current!.setMatrixAt(i, d.matrix)
      sticks.current!.setColorAt(i, c.set(colors[i % colors.length]).multiplyScalar(2.6))
    })
    bodies.current!.instanceMatrix.needsUpdate = true
    sticks.current!.instanceMatrix.needsUpdate = true
    sticks.current!.instanceColor!.needsUpdate = true
  }, [list])
  return (
    <group>
      <instancedMesh ref={bodies} args={[new THREE.CapsuleGeometry(0.28, 1.0, 4, 8), toon('#1a1626'), list.length]} frustumCulled={false} />
      <instancedMesh ref={sticks} args={[cyl(0.04, 0.04, 0.45, 6), neon('#ffffff', 1), list.length]} frustumCulled={false} />
    </group>
  )
}

function Skyline() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = rng(33)
    const out: { x: number; z: number; w: number; h: number }[] = []
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2
      const d = 170 + r() * 160
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: 10 + r() * 18, h: 18 + r() * 60 })
    }
    return out
  }, [])
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#0d0c18'
    g.fillRect(0, 0, 64, 128)
    for (let y = 4; y < 128; y += 8)
      for (let x = 4; x < 64; x += 8) {
        if (Math.random() < 0.45) continue
        g.fillStyle = Math.random() < 0.7 ? '#ffd88a' : '#9fd6ff'
        g.fillRect(x, y, 4, 4)
      }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false })
  }, [])
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    list.forEach((b, i) => {
      d.position.set(b.x, b.h / 2, b.z)
      d.scale.set(b.w, b.h, b.w)
      d.lookAt(0, b.h / 2, 0)
      d.updateMatrix()
      ref.current!.setMatrixAt(i, d.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [list])
  return <instancedMesh ref={ref} args={[new THREE.BoxGeometry(1, 1, 1), mat, list.length]} frustumCulled={false} />
}

/** Taipei 101 on the skyline: stacked flared segments outlined in light. */
function Taipei101() {
  const parts = useMemo(() => {
    const list: { geo: THREE.BufferGeometry; y: number }[] = []
    const frustum = (wb: number, wt: number, h: number) => new THREE.CylinderGeometry(wt / Math.SQRT2, wb / Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4)
    let y = 0
    const push = (g: THREE.BufferGeometry, h: number) => {
      list.push({ geo: g, y: y + h / 2 })
      y += h
    }
    push(new THREE.BoxGeometry(20, 8, 20), 8)
    push(frustum(14, 10.5, 16), 16)
    for (let i = 0; i < 8; i++) push(frustum(9.8, 12, 7), 7)
    push(frustum(8, 6.8, 3), 3)
    push(frustum(5.8, 4.8, 3), 3)
    push(new THREE.CylinderGeometry(0.3, 0.6, 16, 8), 16)
    return list
  }, [])
  return (
    <group position={[120, 0, -230]}>
      {parts.map((p, i) => (
        <group key={i} position={[0, p.y, 0]}>
          <mesh geometry={p.geo} material={toon('#173a3a', { emissive: '#0a2a2a', emissiveIntensity: 0.7 })} />
          <lineSegments geometry={new THREE.EdgesGeometry(p.geo)} material={neon('#7dfff0', 2.2)} />
        </group>
      ))}
    </group>
  )
}

/** Night at 大安森林公園: the open-air stage, a packed lawn, trees, and the skyline around. */
export function Park() {
  const aim = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 3, -1)
    return o
  }, [])
  return (
    <group>
      <NightSky />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={toon('#1d3d26')}>
        <circleGeometry args={[420, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 14]} material={toon('#2c5a33')}>
        <circleGeometry args={[26, 48, Math.PI * 0.08, Math.PI * 0.84]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, s * 0.5]} position={[s * 22, 0.015, 30]} material={toon('#6d6a5a')}>
          <planeGeometry args={[3, 70]} />
        </mesh>
      ))}
      <Stage />
      <Amphitheater />
      <Audience />
      <Trees />
      <Skyline />
      <Taipei101 />
      <mesh position={[-160, 150, -380]} material={neon('#fff3c4', 1.6)}>
        <sphereGeometry args={[22, 32, 16]} />
      </mesh>
      <hemisphereLight args={['#6f7cff', '#1a2a12', 0.7]} />
      <directionalLight position={[-60, 90, 40]} intensity={0.9} color="#c8d4ff" />
      <primitive object={aim} />
      <spotLight position={[-6, 9, 9]} angle={0.4} penumbra={0.6} intensity={140} distance={40} decay={1.4} color="#ffffff" target={aim} />
      <spotLight position={[6, 9, 9]} angle={0.4} penumbra={0.6} intensity={140} distance={40} decay={1.4} color="#ffe7b0" target={aim} />
      <pointLight position={[0, 6, -4]} intensity={60} distance={20} color="#ff2a8a" />
    </group>
  )
}
