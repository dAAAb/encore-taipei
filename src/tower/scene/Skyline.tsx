import { useMemo } from 'react'
import * as THREE from 'three'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, SANITIZE, toon } from '@/three/toon'
import { DEPTH, WIDTH } from '../layout'

const FOG = new THREE.Color('#1d0c2e')

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Night sky dome: deep navy overhead, a violet-pink glow along the horizon. */
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 top = vec3(0.012, 0.016, 0.06);
            vec3 mid = vec3(0.07, 0.03, 0.14);
            vec3 hor = vec3(0.42, 0.12, 0.32);
            vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h));
            c = mix(c, top, smoothstep(0.18, 0.7, h));
            gl_FragColor = vec4(c, 1.0);
            ${SANITIZE}
          }
        `,
      }),
    [],
  )
  const stars = useMemo(() => {
    const r = rand(7)
    const n = 1600
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const y = 0.12 + r() * 0.88
      const s = Math.sqrt(1 - y * y)
      p.set([Math.cos(a) * s * 1400, y * 1400, Math.sin(a) * s * 1400], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  return (
    <group>
      <mesh material={mat}>
        <sphereGeometry args={[1500, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color={new THREE.Color(1.6, 1.6, 1.9)} size={2.2} sizeAttenuation={false} toneMapped={false} fog={false} />
      </points>
      <mesh position={[-520, 520, -1100]} material={neon('#fff1c9', 2.4)} geometry={sphere(34, 32, 20)} />
    </group>
  )
}

/** Hundreds of towers in one draw call; windows are procedural in world space so nothing stretches. */
function City() {
  const mesh = useMemo(() => {
    const r = rand(42)
    const geo = new THREE.BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0)
    const mat = new THREE.ShaderMaterial({
      uniforms: { fogColor: { value: FOG } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vDist;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vec4 mv = viewMatrix * wp;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 fogColor;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vDist;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 base = vec3(0.035, 0.035, 0.06) * (0.7 + 0.3 * abs(vNormal.x));
          vec3 col = base;
          if (abs(vNormal.y) < 0.5) {
            vec2 c = abs(vNormal.x) > 0.5 ? vWorld.zy : vWorld.xy;
            vec2 cell = floor(c / vec2(2.4, 3.2));
            vec2 f = fract(c / vec2(2.4, 3.2));
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.78);
            float h = hash(cell + floor(vWorld.x * 0.02) * 7.0);
            float lit = step(0.78, h);
            vec3 warm = mix(vec3(1.0, 0.7, 0.36), vec3(0.5, 0.72, 1.0), step(0.6, hash(cell * 1.7)));
            float near = 1.0 - smoothstep(150.0, 650.0, vDist) * 0.6;
            col += win * (lit * warm * (0.45 + 0.55 * hash(cell * 3.1)) * near + (1.0 - lit) * vec3(0.03, 0.035, 0.07));
          }
          float fog = smoothstep(120.0, 900.0, vDist);
          gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
          ${SANITIZE}
        }
      `,
    })
    const n = 340
    const m = new THREE.InstancedMesh(geo, mat, n)
    const o = new THREE.Object3D()
    let k = 0
    for (let i = 0; i < n * 3 && k < n; i++) {
      const a = r() * Math.PI * 2
      const d = 55 + Math.pow(r(), 0.6) * 700
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      // keep the drone's corridor in front of the tower clear
      if (z > 0 && Math.abs(x) < 70 + z * 0.35 && d < 260) continue
      const w = 8 + r() * 16
      o.position.set(x, 0, z)
      o.rotation.y = Math.round(r() * 3) * (Math.PI / 2) + (r() - 0.5) * 0.3
      o.scale.set(w, 12 + Math.pow(r(), 1.8) * (d < 200 ? 70 : 140), 8 + r() * 14)
      o.updateMatrix()
      m.setMatrixAt(k++, o.matrix)
    }
    m.count = k
    m.frustumCulled = false
    return m
  }, [])
  return <primitive object={mesh} />
}

/** Taipei 101 on the horizon: eight flared tiers, a base, and a spire. */
function Taipei101() {
  const tiers = Array.from({ length: 8 }, (_, i) => i)
  return (
    <group position={[260, 0, -560]} scale={1.6}>
      <Part geo={rbox(34, 60, 34, 1)} mat={toon('#141a26')} position={[0, 30, 0]} outline={0.4} />
      {tiers.map((i) => (
        <group key={i} position={[0, 60 + i * 18, 0]}>
          <Part geo={cyl(15, 12, 18, 4)} mat={toon('#16202c')} rotation={[0, Math.PI / 4, 0]} position={[0, 9, 0]} outline={0.35} />
          <mesh position={[0, 17.6, 0]} rotation={[0, Math.PI / 4, 0]} material={neon(['#59ff7a', '#2ef2ff', '#ffd400', '#ff6ad5'][i % 4], 1.8)}>
            <cylinderGeometry args={[15.1, 15.1, 0.4, 4, 1, true]} />
          </mesh>
        </group>
      ))}
      <Part geo={rbox(16, 14, 16, 0.6)} mat={toon('#141a26')} position={[0, 211, 0]} outline={0.3} />
      <mesh geometry={cyl(0.6, 1.4, 50, 8)} material={toon('#1c2430')} position={[0, 243, 0]} />
      <mesh geometry={sphere(1.6, 10, 8)} material={neon('#ff2a4d', 4)} position={[0, 269, 0]} />
    </group>
  )
}

function Plaza() {
  const trees = useMemo(() => {
    const out: [number, number, number][] = []
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1
      out.push([side * (WIDTH / 2 + 5 + (i % 3) * 3.5), 0, DEPTH / 2 + 4 + Math.floor(i / 2) * 4.2 - 14])
    }
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1400, 48]} />
        <meshBasicMaterial color="#07060c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 6]}>
        <planeGeometry args={[60, 46]} />
        <meshToonMaterial color="#22202c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 30]}>
        <planeGeometry args={[140, 10]} />
        <meshBasicMaterial color="#0d0c14" />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-65 + i * 10, 0.03, 30]} rotation={[-Math.PI / 2, 0, 0]} material={neon('#ffd400', 0.9)}>
          <planeGeometry args={[4, 0.25]} />
        </mesh>
      ))}
      {trees.map(([x, , z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={cyl(0.18, 0.26, 2.4, 8)} material={toon('#3a2618')} position={[0, 1.2, 0]} />
          <Part geo={sphere(1.6, 14, 10)} mat={toon(i % 2 ? '#1f5e3a' : '#2a7448')} position={[0, 3.2, 0]} outline={0.04} />
        </group>
      ))}
      {[-12, 12].flatMap((x) =>
        [8, 18].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh geometry={cyl(0.08, 0.1, 4.2, 8)} material={toon('#1c1a22')} position={[0, 2.1, 0]} />
            <mesh geometry={sphere(0.32, 10, 8)} material={neon('#ffe2a8', 3)} position={[0, 4.3, 0]} />
          </group>
        )),
      )}
    </group>
  )
}

export function Skyline() {
  return (
    <group>
      <Sky />
      <City />
      <Taipei101 />
      <Plaza />
    </group>
  )
}

export const SKY_FOG = FOG
