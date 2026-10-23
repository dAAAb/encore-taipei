import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { BANDS, ink, neon, SANITIZE, toon } from '@/three/toon'

/** Stage deck height; the TV stands on it. */
export const DECK = 1.2

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Instanced material whose instances bob in the vertex shader (no per-frame matrix uploads). */
function bobbing<T extends THREE.Material>(m: T, amp: number, speed: number, key: string) {
  const uniforms = { uTime: { value: 0 } }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
          transformed.y += max(0.0, sin(uTime * ${speed.toFixed(2)} + ph)) * ${amp.toFixed(3)};
        #endif`,
      )
  }
  m.customProgramCacheKey = () => key
  return { material: m, uniforms }
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
          float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
          void main() {
            float h = vDir.y;
            vec3 horizon = vec3(0.36, 0.14, 0.32);
            vec3 mid = vec3(0.07, 0.08, 0.22);
            vec3 top = vec3(0.01, 0.015, 0.05);
            vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
            col = mix(col, top, smoothstep(0.2, 0.75, h));
            vec2 g = vec2(atan(vDir.z, vDir.x) * 120.0, h * 120.0);
            float star = step(0.9965, h21(floor(g))) * smoothstep(0.08, 0.3, h);
            col += vec3(star * 1.4);
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

/** 大安森林公園露天音樂台: inverted stepped-pyramid space-frame roof on two tapered piers. */
function Amphitheater() {
  const frameTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#d9dde3'
    g.fillRect(0, 0, 128, 128)
    g.strokeStyle = '#8f96a3'
    g.lineWidth = 3
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 128)
      g.moveTo(0, i)
      g.lineTo(128, i)
      g.stroke()
    }
    g.lineWidth = 1.5
    g.beginPath()
    for (let i = -128; i <= 128; i += 32) {
      g.moveTo(i, 0)
      g.lineTo(i + 128, 128)
      g.moveTo(i + 128, 0)
      g.lineTo(i, 128)
    }
    g.stroke()
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const tiers = [
    { w: 9, d: 7, y: 8.4 },
    { w: 12.5, d: 9.5, y: 9.15 },
    { w: 16, d: 12, y: 9.9 },
  ]
  const fascia = toon('#c9652e')
  const soffit = useMemo(() => {
    const g = new THREE.ConeGeometry(4.2, 2.6, 4, 1)
    g.rotateY(Math.PI / 4)
    g.rotateX(Math.PI)
    return g
  }, [])
  const glass = useMemo(() => new THREE.ConeGeometry(2.1, 1.6, 4, 1).rotateY(Math.PI / 4), [])
  return (
    <group position={[0, 0, -6.2]}>
      {tiers.map((t, i) => {
        const m = new THREE.MeshToonMaterial({ color: '#ffffff', map: frameTex.clone(), gradientMap: BANDS })
        m.map!.repeat.set(t.w / 2, t.d / 2)
        m.map!.needsUpdate = true
        return (
          <group key={i} position={[0, t.y, 0]}>
            <Part geo={rbox(t.w, 0.7, t.d, 0.05)} mat={m} outline={0.03} />
            {[
              [0, t.d / 2, t.w, 0.12],
              [0, -t.d / 2, t.w, 0.12],
            ].map(([x, z, w, dd], k) => (
              <mesh key={k} geometry={rbox(w + 0.2, 0.32, dd, 0.03)} material={fascia} position={[x, 0.22, z]} />
            ))}
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={rbox(0.12, 0.32, t.d + 0.2, 0.03)} material={fascia} position={[(sx * t.w) / 2, 0.22, 0]} />
            ))}
          </group>
        )
      })}
      <mesh geometry={soffit} material={toon('#b9c0ca')} position={[0, 6.9, 0]} />
      <mesh geometry={glass} position={[0, 11.05, 0]}>
        <meshBasicMaterial color={new THREE.Color(0.55, 0.85, 1.4)} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <Part key={s} geo={cyl(0.35, 0.75, 7.2, 4)} mat={toon('#8e8c88')} position={[s * 5, 4.8, -2.4]} rotation={[0, Math.PI / 4, 0]} outline={0.03} />
      ))}
      <Part geo={rbox(15, 5.2, 0.6, 0.06)} mat={toon('#8b8276')} position={[0, DECK + 2.6, -3.8]} outline={0.03} />
    </group>
  )
}

function Stage() {
  return (
    <group>
      <Part geo={rbox(18, DECK, 12, 0.08)} mat={toon('#a7a39b')} position={[0, DECK / 2, -4.25]} outline={0.04} />
      <Part geo={rbox(7, 0.45, 1.4, 0.05)} mat={toon('#97938b')} position={[0, 0.22, 2.4]} outline={0.03} />
      <mesh geometry={rbox(18, 0.06, 0.06, 0.02)} material={neon('#ffd400', 2.6)} position={[0, DECK + 0.01, 1.75]} />
      {[-8, 8].map((x) => (
        <group key={x} position={[x, 0, 2]}>
          <Part geo={rbox(1.6, 3.2, 1.2, 0.06)} mat={toon('#1c1b22')} position={[0, DECK + 1.6, 0]} outline={0.03} />
          {[0.8, 2.2].map((y) => (
            <mesh key={y} geometry={cyl(0.38, 0.38, 0.05, 20)} material={neon(y > 1 ? '#2ef2ff' : '#ff2a4d', 1.8)} position={[0, DECK + y, 0.62]} rotation={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Concert wash: additive light cones sweeping from the roof and two searchlights stabbing the sky. */
function Beams() {
  const group = useRef<THREE.Group>(null)
  const mats = useMemo(
    () =>
      ['#ff2a8a', '#2ef2ff', '#ffd400', '#9b6bff', '#ffffff', '#ff6a2a'].map(
        (c) =>
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(c) } },
            vertexShader: /* glsl */ `
              varying float vY; varying vec3 vN; varying vec3 vV;
              void main() {
                vY = uv.y;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vN = normalize(mat3(modelMatrix) * normal);
                vV = normalize(cameraPosition - w.xyz);
                gl_Position = projectionMatrix * viewMatrix * w;
              }`,
            fragmentShader: /* glsl */ `
              uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
              void main() {
                float f = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.5);
                float a = f * smoothstep(0.0, 1.0, vY) * 0.22;
                gl_FragColor = vec4(uColor * a * 2.2, a);
                ${SANITIZE}
              }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [],
  )
  const geo = useMemo(() => new THREE.CylinderGeometry(0.15, 2.6, 16, 24, 1, true).translate(0, -8, 0), [])
  const sky = useMemo(() => new THREE.CylinderGeometry(0.4, 6, 220, 24, 1, true).translate(0, 110, 0), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    group.current?.children.forEach((b, i) => {
      if (i < 6) {
        b.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.45
        b.rotation.x = 0.35 + Math.cos(t * 0.7 + i) * 0.25
      } else {
        b.rotation.z = Math.sin(t * 0.25 + i * 2) * 0.3
        b.rotation.x = -0.15 + Math.cos(t * 0.2 + i) * 0.1
      }
    })
  })
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} position={[-6.5 + i * 2.6, 9.4, -0.5]} />
      ))}
      {[-40, 46].map((x, i) => (
        <mesh key={x} geometry={sky} material={mats[i === 0 ? 4 : 1]} position={[x, 0, -60]} />
      ))}
    </group>
  )
}

function Benches() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const out: [number, number, number][] = []
    for (let row = 0; row < 9; row++) {
      const r = 10 + row * 2.2
      const n = 8 + row * 2
      for (let k = 0; k < n; k++) {
        const a = -0.9 + (k / (n - 1)) * 1.8
        if (Math.abs(a) < 0.08) continue
        out.push([Math.sin(a) * r, Math.cos(a) * r - 1, -a])
      }
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    list.forEach(([x, z, ry], i) => {
      o.position.set(x, 0.25, z)
      o.rotation.set(0, ry, 0)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [list])
  return <instancedMesh ref={ref} args={[rbox(2.2, 0.5, 0.5, 0.06), toon('#6e2230'), list.length]} frustumCulled={false} />
}

function Crowd({ count }: { count: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const sticks = useRef<THREE.InstancedMesh>(null)
  const body = useMemo(() => bobbing(toon('#ffffff').clone(), 0.35, 4.2, 'crowd-body'), [])
  const head = useMemo(() => bobbing(toon('#ffffff').clone(), 0.35, 4.2, 'crowd-head'), [])
  const stick = useMemo(() => bobbing(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 0.45, 4.2, 'crowd-stick'), [])
  const list = useMemo(() => {
    const r = rng(19)
    const out: { x: number; z: number; h: number }[] = []
    while (out.length < count) {
      const a = (r() - 0.5) * 2.3
      const d = 6 + Math.pow(r(), 0.7) * 40
      const x = Math.sin(a) * d * 1.15
      const z = Math.cos(a) * d - 1
      if (z < 3.5) continue
      out.push({ x, z, h: 1.45 + r() * 0.4 })
    }
    return out
  }, [count])
  const shirts = ['#1a1626', '#2b2142', '#1d2a44', '#3a1d2e', '#232323', '#f0e6d2', '#24324f']
  const glow = ['#ff2a4d', '#2ef2ff', '#ffd400', '#ffffff', '#59ff7a', '#ff6ad5']
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((p, i) => {
      o.position.set(p.x, p.h * 0.42, p.z)
      o.rotation.set(0, Math.atan2(-p.x, -p.z - 1), 0)
      o.scale.set(1, p.h / 1.5, 1)
      o.updateMatrix()
      bodies.current!.setMatrixAt(i, o.matrix)
      bodies.current!.setColorAt(i, c.set(shirts[i % shirts.length]))
      o.position.set(p.x, p.h * 0.9, p.z)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      heads.current!.setMatrixAt(i, o.matrix)
      heads.current!.setColorAt(i, c.set(i % 3 ? '#16121c' : '#2b2026'))
      o.position.set(p.x + 0.28, p.h + 0.45, p.z)
      o.rotation.set(0, 0, (i % 5) * 0.12 - 0.24)
      o.updateMatrix()
      sticks.current!.setMatrixAt(i, o.matrix)
      sticks.current!.setColorAt(i, c.set(glow[i % glow.length]).multiplyScalar(i % 4 === 0 ? 0 : 2.8))
    })
    for (const m of [bodies.current!, heads.current!, sticks.current!]) {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    }
  }, [list])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    body.uniforms.uTime.value = t
    head.uniforms.uTime.value = t
    stick.uniforms.uTime.value = t
  })
  return (
    <group>
      <instancedMesh ref={bodies} args={[new THREE.CapsuleGeometry(0.27, 0.75, 3, 8), body.material, list.length]} frustumCulled={false} />
      <instancedMesh ref={heads} args={[sphere(0.2, 10, 8), head.material, list.length]} frustumCulled={false} />
      <instancedMesh ref={sticks} args={[cyl(0.035, 0.035, 0.5, 6), stick.material, list.length]} frustumCulled={false} />
    </group>
  )
}

/** A forest of broadleaf crowns, tall cones and shrubs: Daan Park is mostly trees. */
function Forest({ count }: { count: number }) {
  const blobs = useRef<THREE.InstancedMesh>(null)
  const blobInk = useRef<THREE.InstancedMesh>(null)
  const cones = useRef<THREE.InstancedMesh>(null)
  const coneInk = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const shrubs = useRef<THREE.InstancedMesh>(null)
  const plan = useMemo(() => {
    const r = rng(7)
    const greens = ['#2f6b3a', '#3d7f44', '#27593a', '#4a8c4c', '#1f4d33', '#56a05a', '#2c6644', '#3f7a3a']
    const blob: { p: THREE.Vector3; s: THREE.Vector3; c: string }[] = []
    const cone: { p: THREE.Vector3; s: THREE.Vector3; c: string }[] = []
    const trunk: { p: THREE.Vector3; s: THREE.Vector3 }[] = []
    const shrub: { p: THREE.Vector3; s: number; c: string }[] = []
    let made = 0
    while (made < count) {
      const a = r() * Math.PI * 2
      const d = 26 + Math.pow(r(), 0.8) * 150
      const x = Math.cos(a) * d * 1.1
      const z = Math.sin(a) * d - 6
      const lawn = z > 2 && z < 52 && Math.abs(x) < 10 + (z - 2) * 0.9
      if (lawn) continue
      const pathL = Math.abs(x + 26 - (z - 30) * 0.5) < 2.2 && z > 0
      const pathR = Math.abs(x - 26 + (z - 30) * 0.5) < 2.2 && z > 0
      if (pathL || pathR) continue
      made++
      const size = 2.2 + r() * 2.8
      const c = greens[Math.floor(r() * greens.length)]
      const h = size * (1.6 + r() * 0.8)
      trunk.push({ p: new THREE.Vector3(x, h * 0.35, z), s: new THREE.Vector3(size * 0.12, h * 0.7, size * 0.12) })
      if (r() < 0.22) {
        cone.push({ p: new THREE.Vector3(x, h + size * 0.6, z), s: new THREE.Vector3(size * 0.9, size * 2.4, size * 0.9), c })
      } else {
        const n = 2 + Math.floor(r() * 3)
        for (let k = 0; k < n; k++) {
          const ox = (r() - 0.5) * size * 1.1
          const oz = (r() - 0.5) * size * 1.1
          const sc = size * (0.6 + r() * 0.5)
          blob.push({ p: new THREE.Vector3(x + ox, h + (r() - 0.3) * size * 0.6, z + oz), s: new THREE.Vector3(sc, sc * 0.85, sc), c })
        }
      }
      if (r() < 0.6) shrub.push({ p: new THREE.Vector3(x + (r() - 0.5) * 5, 0.5, z + (r() - 0.5) * 5), s: 0.8 + r() * 1.2, c: greens[Math.floor(r() * greens.length)] })
    }
    for (let z = 4; z < 50; z += 3.2)
      for (const s of [-1, 1]) {
        const x = s * (11 + (z - 2) * 0.9 + 1.5)
        shrub.push({ p: new THREE.Vector3(x, 0.55, z), s: 1.2, c: '#2f6b3a' })
      }
    return { blob, cone, trunk, shrub }
  }, [count])

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const fill = (mesh: THREE.InstancedMesh, items: { p: THREE.Vector3; s: THREE.Vector3 | number; c?: string }[]) => {
      items.forEach((it, i) => {
        o.position.copy(it.p)
        if (typeof it.s === 'number') o.scale.setScalar(it.s)
        else o.scale.copy(it.s)
        o.rotation.set(0, i * 1.7, 0)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
        if (it.c && mesh.instanceColor) mesh.setColorAt(i, c.set(it.c))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    fill(blobs.current!, plan.blob)
    fill(cones.current!, plan.cone)
    fill(trunks.current!, plan.trunk)
    fill(shrubs.current!, plan.shrub)
    blobInk.current!.instanceMatrix = blobs.current!.instanceMatrix
    coneInk.current!.instanceMatrix = cones.current!.instanceMatrix
  }, [plan])

  const blobGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const coneGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 8, 1), [])
  const leaf = useMemo(() => toon('#ffffff').clone(), [])
  const leaf2 = useMemo(() => toon('#ffffff').clone(), [])
  const shrubMat = useMemo(() => toon('#ffffff').clone(), [])
  return (
    <group>
      <instancedMesh ref={blobs} args={[blobGeo, leaf, plan.blob.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(plan.blob.length * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={blobInk} args={[blobGeo, ink(0.035), plan.blob.length]} frustumCulled={false} />
      <instancedMesh ref={cones} args={[coneGeo, leaf2, plan.cone.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(plan.cone.length * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={coneInk} args={[coneGeo, ink(0.035), plan.cone.length]} frustumCulled={false} />
      <instancedMesh ref={trunks} args={[cyl(1, 1, 1, 6), toon('#4a3222'), plan.trunk.length]} frustumCulled={false} />
      <instancedMesh ref={shrubs} args={[blobGeo, shrubMat, plan.shrub.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(plan.shrub.length * 3), 3]} />
      </instancedMesh>
    </group>
  )
}

function Lamps() {
  const spots = useMemo(() => {
    const out: [number, number][] = []
    for (let z = 2; z < 60; z += 7) for (const s of [-1, 1]) out.push([s * (12 + (z - 2) * 0.9), z])
    return out
  }, [])
  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh geometry={cyl(0.07, 0.09, 4, 6)} material={toon('#2a2a30')} position={[0, 2, 0]} />
          <mesh geometry={sphere(0.32, 12, 8)} material={neon('#ffe2a0', 3)} position={[0, 4.1, 0]} />
        </group>
      ))}
    </group>
  )
}

function Skyline() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = rng(33)
    const out: { x: number; z: number; w: number; h: number }[] = []
    for (let i = 0; i < 200; i++) {
      const a = r() * Math.PI * 2
      const d = 200 + r() * 170
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: 10 + r() * 18, h: 22 + r() * 70 })
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

/** Night at 大安森林公園: the open-air stage, a packed lawn, a forest, and the skyline around. */
export function Park({ lowPower = false }: { lowPower?: boolean }) {
  const aim = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 3, -1)
    return o
  }, [])
  return (
    <group>
      <NightSky />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={toon('#1b3a24')}>
        <circleGeometry args={[420, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1]} material={toon('#2c5a33')}>
        <circleGeometry args={[52, 64, Math.PI * 0.12, Math.PI * 0.76]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, s * 0.46]} position={[s * 26, 0.015, 32]} material={toon('#77735f')}>
          <planeGeometry args={[3.6, 80]} />
        </mesh>
      ))}
      <Stage />
      <Amphitheater />
      <Benches />
      <Crowd count={lowPower ? 800 : 1600} />
      <Forest count={lowPower ? 700 : 1400} />
      <Lamps />
      <Beams />
      <Skyline />
      <Taipei101 />
      <mesh position={[-160, 150, -380]} material={neon('#fff3c4', 1.6)}>
        <sphereGeometry args={[22, 32, 16]} />
      </mesh>
      <hemisphereLight args={['#6f7cff', '#1a2a12', 0.75]} />
      <directionalLight position={[-60, 90, 40]} intensity={0.9} color="#c8d4ff" />
      <primitive object={aim} />
      <spotLight position={[-6, 11, 10]} angle={0.42} penumbra={0.6} intensity={160} distance={45} decay={1.4} color="#ffffff" target={aim} />
      <spotLight position={[6, 11, 10]} angle={0.42} penumbra={0.6} intensity={160} distance={45} decay={1.4} color="#ffe7b0" target={aim} />
      <pointLight position={[0, 6, -5]} intensity={70} distance={22} color="#ff2a8a" />
      <pointLight position={[0, 3, 14]} intensity={40} distance={30} color="#2ef2ff" />
    </group>
  )
}
