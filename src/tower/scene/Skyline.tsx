import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useSite } from '@/lib/season'
import { cyl, rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, SANITIZE, toon } from '@/three/toon'
import { DEPTH, WIDTH } from '../layout'

const FOG = new THREE.Color('#1d0c2e')
/** The 2099 season's daytime haze and sky behind it. */
export const DAY_FOG = new THREE.Color('#e6e1d4')
export const DAY_SKY = new THREE.Color('#cfe3ff')

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Sky dome: at night deep navy with a violet-pink horizon; by day (2099) a clear blue over a golden haze. */
function Sky({ day }: { day: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uDay: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uDay;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 top = mix(vec3(0.012, 0.016, 0.06), vec3(0.22, 0.52, 1.0), uDay);
            vec3 mid = mix(vec3(0.07, 0.03, 0.14), vec3(0.55, 0.76, 1.0), uDay);
            vec3 hor = mix(vec3(0.42, 0.12, 0.32), vec3(1.0, 0.9, 0.7), uDay);
            vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h));
            c = mix(c, top, smoothstep(0.18, 0.7, h));
            float sun = max(dot(normalize(vDir), normalize(vec3(-0.35, 0.42, -0.84))), 0.0);
            c += uDay * (vec3(1.0, 0.9, 0.7) * pow(sun, 700.0) * 2.5 + vec3(1.0, 0.85, 0.6) * pow(sun, 12.0) * 0.25);
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
  mat.uniforms.uDay.value = day ? 1 : 0
  return (
    <group>
      <mesh material={mat}>
        <sphereGeometry args={[1500, 32, 16]} />
      </mesh>
      {!day && (
        <points geometry={stars}>
          <pointsMaterial color={new THREE.Color(1.6, 1.6, 1.9)} size={2.2} sizeAttenuation={false} toneMapped={false} fog={false} />
        </points>
      )}
      {!day && <mesh position={[-520, 520, -1100]} material={neon('#fff1c9', 2.4)} geometry={sphere(34, 32, 20)} />}
      {day && <Clouds />}
    </group>
  )
}

/** A few flat-bottomed toon clouds drifting slowly over the city. */
function Clouds() {
  const puffs = useMemo(() => {
    const r = rand(5)
    return Array.from({ length: 14 }, () => {
      const a = r() * Math.PI * 2
      const d = 500 + r() * 600
      return { x: Math.cos(a) * d, y: 180 + r() * 220, z: Math.sin(a) * d, s: 30 + r() * 40, k: Math.floor(3 + r() * 3) }
    })
  }, [])
  const group = useMemo(() => new THREE.Group(), [])
  useFrame((_, dt) => {
    group.rotation.y += dt * 0.002
  })
  return (
    <primitive object={group}>
      {puffs.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} scale={[p.s, p.s * 0.45, p.s * 0.7]}>
          {Array.from({ length: p.k }, (_, j) => (
            <mesh key={j} geometry={sphere(1, 14, 10)} material={toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 })} position={[(j - p.k / 2) * 0.9, (j % 2) * 0.25, 0]} />
          ))}
        </group>
      ))}
    </primitive>
  )
}

/** Hundreds of towers in one draw call; windows are procedural in world space so nothing stretches. */
function City({ day }: { day: boolean }) {
  const mesh = useMemo(() => {
    const r = rand(42)
    const geo = new THREE.BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0)
    const mat = new THREE.ShaderMaterial({
      uniforms: { fogColor: { value: FOG.clone() }, uDay: { value: 0 } },
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
        uniform float uDay;
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
          if (uDay > 0.5) {
            float tint = hash(floor(vWorld.xz / 9.0));
            vec3 facade = mix(vec3(0.95, 0.95, 0.96), vec3(0.98, 0.92, 0.76), step(0.78, tint));
            col = facade * (0.72 + 0.28 * abs(vNormal.x) + 0.2 * step(0.5, vNormal.y));
            if (abs(vNormal.y) < 0.5) {
              vec2 c = abs(vNormal.x) > 0.5 ? vWorld.zy : vWorld.xy;
              vec2 f = fract(c / vec2(2.4, 3.2));
              float band = step(0.2, f.y) * step(f.y, 0.8);
              vec3 glass = mix(vec3(0.42, 0.62, 0.9), vec3(0.75, 0.88, 1.0), smoothstep(0.0, 160.0, vWorld.y));
              col = mix(col, glass, band * step(0.35, tint));
            }
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
  const mat = mesh.material as THREE.ShaderMaterial
  mat.uniforms.uDay.value = day ? 1 : 0
  mat.uniforms.fogColor.value.copy(day ? DAY_FOG : FOG)
  return <primitive object={mesh} />
}

/** Taipei 101 on the horizon: eight flared tiers, a base, and a spire. */
function Taipei101({ day }: { day: boolean }) {
  const tiers = Array.from({ length: 8 }, (_, i) => i)
  const body = day ? '#eef1f6' : '#141a26'
  const tier = day ? '#f4f6fa' : '#16202c'
  return (
    <group position={[260, 0, -560]} scale={1.6}>
      <Part geo={rbox(34, 60, 34, 1)} mat={toon(body)} position={[0, 30, 0]} outline={0.4} />
      {tiers.map((i) => (
        <group key={i} position={[0, 60 + i * 18, 0]}>
          <Part geo={cyl(15, 12, 18, 4)} mat={toon(tier)} rotation={[0, Math.PI / 4, 0]} position={[0, 9, 0]} outline={0.35} />
          <mesh
            position={[0, 17.6, 0]}
            rotation={[0, Math.PI / 4, 0]}
            material={day ? neon(i % 2 ? '#ffd400' : '#7fb2ff', 1.2) : neon(['#59ff7a', '#2ef2ff', '#ffd400', '#ff6ad5'][i % 4], 1.8)}
          >
            <cylinderGeometry args={[15.1, 15.1, 0.4, 4, 1, true]} />
          </mesh>
        </group>
      ))}
      <Part geo={rbox(16, 14, 16, 0.6)} mat={toon(body)} position={[0, 211, 0]} outline={0.3} />
      <mesh geometry={cyl(0.6, 1.4, 50, 8)} material={toon(day ? '#e8c15a' : '#1c2430')} position={[0, 243, 0]} />
      <mesh geometry={sphere(1.6, 10, 8)} material={neon('#ff2a4d', 4)} position={[0, 269, 0]} />
    </group>
  )
}

function Plaza({ day }: { day: boolean }) {
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
        <meshBasicMaterial color={day ? '#d6d0c2' : '#07060c'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 6]}>
        <planeGeometry args={[60, 46]} />
        <meshToonMaterial color={day ? '#ebe6da' : '#22202c'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 30]}>
        <planeGeometry args={[140, 10]} />
        <meshBasicMaterial color={day ? '#8d93a3' : '#0d0c14'} />
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
  const day = useSite((s) => s.season === '2099')
  return (
    <group>
      <Sky day={day} />
      <City day={day} />
      <Taipei101 day={day} />
      <Plaza day={day} />
    </group>
  )
}

export const SKY_FOG = FOG
