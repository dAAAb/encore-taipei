import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { beatNow, isChorus, pulse } from '@/audio/beat'
import { cyl, rbox, sphere, torus } from '@/three/geo'
import { Part } from '@/three/Part'
import { BANDS, neon, SANITIZE, shadowCatcher, toon } from '@/three/toon'
import { FLOOR } from './Clouds'
import { NeonText } from './NeonText'

export const GLASS_Z = -21

function DanceFloor() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uBeat: { value: 0 }, uChorus: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vXZ;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vXZ = w.xz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uBeat; uniform float uChorus;
          varying vec2 vXZ;
          void main() {
            vec2 g = abs(fract(vXZ / 1.5) - 0.5);
            float line = smoothstep(0.47, 0.5, max(g.x, g.y));
            float d = length(vXZ - vec2(0.0, -11.0));
            float wave = fract(uBeat);
            float ring = (1.0 - smoothstep(0.0, 1.2, abs(d - 7.0 - wave * 16.0))) * (1.0 - wave);
            vec3 a = vec3(1.0, 0.16, 0.3);
            vec3 b = vec3(0.18, 0.95, 1.0);
            vec3 col = mix(a, b, 0.5 + 0.5 * sin(d * 0.25 - uBeat * 0.8));
            float fade = 1.0 - smoothstep(6.0, 26.0, d);
            float alpha = clamp((line * 0.22 + ring * line * 1.4 + ring * 0.08 * uChorus) * fade, 0.0, 1.0);
            gl_FragColor = vec4(col * 2.0, alpha);
            ${SANITIZE}
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useFrame(() => {
    const b = beatNow()
    mat.uniforms.uBeat.value = b
    mat.uniforms.uChorus.value = isChorus(b) ? 1 : 0
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={mat}>
      <planeGeometry args={[40, 40]} />
    </mesh>
  )
}

function GlassFacade() {
  const xs = useMemo(() => Array.from({ length: 11 }, (_, i) => -25 + i * 5), [])
  return (
    <group position={[0, 0, GLASS_Z]}>
      <mesh position={[0, 9, 0]}>
        <planeGeometry args={[52, 18]} />
        <meshBasicMaterial color="#5f86ff" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {xs.map((x) => (
        <Part key={x} geo={rbox(0.32, 18, 0.5, 0.06)} mat={toon('#1b1726')} position={[x, 9, 0]} outline={0.04} />
      ))}
      <Part geo={rbox(52, 0.5, 0.7, 0.08)} mat={toon('#1b1726')} position={[0, 0.25, 0]} outline={0.04} />
      <Part geo={rbox(52, 0.6, 0.7, 0.08)} mat={toon('#1b1726')} position={[0, 17.7, 0]} outline={0.04} />
      <mesh geometry={rbox(52, 0.06, 0.06, 0.02)} material={neon('#ff2a4d', 2.6)} position={[0, 0.55, 0.4]} />
      {[-12.5, 12.5].map((x) => (
        <mesh key={x} geometry={rbox(0.06, 17, 0.06, 0.02)} material={neon('#2ef2ff', 1.6)} position={[x + 2.5 * Math.sign(x), 9, 0.32]} />
      ))}
    </group>
  )
}

function Bottles() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const cols = ['#ffb347', '#2ef2ff', '#ff2a8a', '#b6ff4a', '#ffd400', '#9b6bff']
  const list = useMemo(() => {
    const out: { p: [number, number, number]; c: string; h: number }[] = []
    let s = 3
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 22; i++) out.push({ p: [-17.6 + i * 0.32, 2.15 + row * 0.85, GLASS_Z + 3.0], c: cols[Math.floor(r() * cols.length)], h: 0.35 + r() * 0.25 })
    return out
  }, [])
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((b, i) => {
      d.position.set(b.p[0], b.p[1] + b.h / 2, b.p[2])
      d.scale.set(1, b.h / 0.5, 1)
      d.updateMatrix()
      ref.current!.setMatrixAt(i, d.matrix)
      ref.current!.setColorAt(i, c.set(b.c).multiplyScalar(1.8))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [list])
  return <instancedMesh ref={ref} args={[cyl(0.09, 0.11, 0.5, 8), neon('#ffffff', 1), list.length]} />
}

/** The Afterlife: a crimson-lit bar silhouetted against the city, back-left. */
function AfterlifeBar() {
  const sign = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = performance.now() / 1000
    const flick = Math.sin(t * 37) > 0.97 || (t % 7 > 6.85) ? 0.15 : 1
    sign.current!.visible = flick > 0.5
  })
  const z = GLASS_Z + 3.0
  return (
    <group>
      <Part geo={rbox(7.6, 0.25, 0.7, 0.05)} mat={toon('#24161c')} position={[-14.2, 2.0, z]} outline={0.025} />
      <Part geo={rbox(7.6, 0.18, 0.7, 0.05)} mat={toon('#24161c')} position={[-14.2, 2.85, z]} outline={0.025} />
      <Part geo={rbox(7.6, 0.18, 0.7, 0.05)} mat={toon('#24161c')} position={[-14.2, 3.7, z]} outline={0.025} />
      <Bottles />
      <Part geo={rbox(8.4, 1.15, 1.4, 0.12)} mat={toon('#3a121d')} position={[-13.9, 0.575, z + 3.2]} outline={0.04} />
      <Part geo={rbox(8.8, 0.14, 1.8, 0.06)} mat={toon('#150b10')} position={[-13.9, 1.2, z + 3.2]} outline={0.03} />
      <mesh geometry={rbox(8.8, 0.06, 0.06, 0.02)} material={neon('#ff2a4d', 3.2)} position={[-13.9, 1.08, z + 4.12]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[-17.2 + i * 1.6, 0, z + 4.6]}>
          <Part geo={cyl(0.05, 0.05, 0.75, 8)} mat={toon('#2b2533')} position={[0, 0.38, 0]} outline={0.015} />
          <Part geo={cyl(0.3, 0.3, 0.1, 16)} mat={toon('#7a1f30')} position={[0, 0.8, 0]} outline={0.02} />
        </group>
      ))}
      <group ref={sign} position={[-13.6, 6.3, z + 1.5]}>
        <NeonText text="黃金十年" size={1.5} material={neon('#ff2a4d', 4)} position={[0, 0.4, 0]} />
        <NeonText text="GOLDEN DECADE" size={0.6} material={neon('#ffb800', 3.4)} position={[0, -0.95, 0]} />
      </group>
      <Part geo={rbox(7.2, 4.4, 0.25, 0.1)} mat={toon('#120a10')} position={[-13.6, 6.15, z + 1.3]} outline={0.04} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cyl(0.02, 0.02, 6, 4)} material={toon('#0c0812')} position={[-13.6 + s * 3, 12.5, z + 1.3]} />
      ))}
    </group>
  )
}

/** VIP booths under a 台北安可 sign, back-right. */
function EncoreLounge() {
  const sign = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = pulse(beatNow(), 4)
    sign.current!.scale.setScalar(1 + 0.03 * k)
  })
  const z = GLASS_Z + 3.4
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} position={[11.8 + i * 4.4, 0, z + 1.2]}>
          <Part geo={rbox(3.6, 0.55, 1.6, 0.2)} mat={toon('#1e3fa8')} position={[0, 0.45, 0]} outline={0.035} />
          <Part geo={rbox(3.6, 1.3, 0.45, 0.2)} mat={toon('#1e3fa8')} position={[0, 1.0, -0.6]} outline={0.035} />
          <Part geo={cyl(0.6, 0.6, 0.08, 20)} mat={toon('#151222')} position={[0, 0.9, 1.5]} outline={0.02} />
          <Part geo={cyl(0.06, 0.12, 0.85, 10)} mat={toon('#151222')} position={[0, 0.45, 1.5]} outline={0.015} />
          <mesh geometry={sphere(0.14, 10, 8)} material={neon('#ffd400', 2.6)} position={[0, 1.1, 1.5]} />
        </group>
      ))}
      <group ref={sign} position={[14.0, 6.4, z + 1.0]}>
        <Part geo={rbox(8.4, 3.4, 0.3, 0.3)} mat={toon('#0e1a4a')} position={[0, 0, -0.2]} outline={0.05} />
        <NeonText text="台北安可" size={1.5} material={neon('#ffd400', 3.6)} position={[0, 0.35, 0]} />
        <NeonText text="TAIPEI ENCORE" size={0.6} material={neon('#2f9bff', 3.6)} position={[0, -1.0, 0]} />
      </group>
    </group>
  )
}

function HangingRings() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const b = beatNow()
    g.current!.children.forEach((r, i) => {
      r.rotation.z = b * 0.05 * (i % 2 ? 1 : -1)
      r.position.y = 12.4 + Math.sin(b * 0.25 + i) * 0.2
    })
  })
  const rings: [number, number, string, number][] = [
    [-8, 1, '#ff2a4d', 2.4],
    [8, 1, '#2ef2ff', 2.4],
    [0, 5, '#ffd400', 3.4],
    [-5, 8, '#2f7bff', 1.8],
    [6, 8, '#ff2a8a', 1.8],
  ]
  return (
    <group ref={g}>
      {rings.map(([x, z, c, r], i) => (
        <group key={i} position={[x, 12.4, z]}>
          <mesh geometry={torus(r, 0.06, Math.PI * 2, 64)} material={neon(c, 3)} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  )
}

/** Club floor that dissolves into the cloud banks instead of ending on a hard edge. */
function Floor() {
  const mat = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: '#1d1629', gradientMap: BANDS })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFloorXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFloorXZ;')
        .replace(
          '#include <dithering_fragment>',
          `float edge = smoothstep(${(FLOOR.halfW - 9).toFixed(1)}, ${(FLOOR.halfW - 0.5).toFixed(1)}, abs(vFloorXZ.x));
          edge = max(edge, 1.0 - smoothstep(${(FLOOR.back + 0.5).toFixed(1)}, ${(FLOOR.back + 4).toFixed(1)}, vFloorXZ.y));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.36, 0.25, 0.58), edge * 0.85);
          #include <dithering_fragment>`,
        )
    }
    m.customProgramCacheKey = () => 'club-floor'
    return m
  }, [])
  const w = FLOOR.halfW * 2
  const d = FLOOR.front - FLOOR.back
  const z = (FLOOR.front + FLOOR.back) / 2
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]} material={mat}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]} receiveShadow material={shadowCatcher(0.5)}>
        <planeGeometry args={[w, d]} />
      </mesh>
    </>
  )
}

export function Club() {
  return (
    <group>
      <Floor />
      <DanceFloor />
      <GlassFacade />
      <AfterlifeBar />
      <EncoreLounge />
      <HangingRings />
    </group>
  )
}
