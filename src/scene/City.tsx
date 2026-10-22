import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { beatNow, pulse } from '@/audio/beat'
import { neon, toon } from '@/three/toon'
import { NeonText } from './NeonText'

/** The club sits high in a tower; the city ground is far below. */
const GROUND = -38

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const towerVertex = /* glsl */ `
  attribute float aTop;
  varying vec3 vWorld; varying vec3 vN; varying vec3 vCol; varying float vTop; varying float vId;
  #include <fog_pars_vertex>
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vCol = instanceColor;
    vTop = aTop;
    vId = float(gl_InstanceID);
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`

const towerFragment = /* glsl */ `
  uniform float uBeat;
  varying vec3 vWorld; varying vec3 vN; varying vec3 vCol; varying float vTop; varying float vId;
  #include <fog_pars_fragment>
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vN);
    vec3 base = vec3(0.05, 0.04, 0.1);
    float band = n.y > 0.5 ? 0.6 : (abs(n.x) > abs(n.z) ? 0.75 : 1.0);
    vec3 col = base * band;
    if (n.y < 0.5) {
      vec2 t = abs(n.x) > abs(n.z) ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
      vec2 cell = floor(t / vec2(1.7, 1.5));
      vec2 f = fract(t / vec2(1.7, 1.5));
      float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.75);
      float lit = step(0.52, hash(vec3(cell, vId)));
      col += win * mix(vec3(0.04, 0.05, 0.09), vCol * 1.5, lit);
      float crown = smoothstep(vTop - 1.6, vTop - 1.2, vWorld.y) * (1.0 - smoothstep(vTop - 0.5, vTop - 0.2, vWorld.y));
      col += crown * vCol * (2.5 + 1.5 * fract(-uBeat));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`

function Towers() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = rng(42)
    const palette = ['#2ef2ff', '#ff2a8a', '#ffb347', '#9b6bff', '#2f7bff', '#ffd400', '#ff4d4d']
    const out: { x: number; z: number; w: number; d: number; h: number; c: string }[] = []
    const add = (x: number, z: number, wMin: number, wMax: number, hMin: number, hMax: number) => {
      const w = wMin + r() * (wMax - wMin)
      out.push({ x, z, w, d: w * (0.7 + r() * 0.6), h: hMin + r() * (hMax - hMin), c: palette[Math.floor(r() * palette.length)] })
    }
    for (let i = 0; i < 70; i++) {
      const side = r() < 0.5 ? -1 : 1
      add(side * (34 + r() * 110), -40 - r() * 110, 8, 16, 18, 58)
    }
    for (let i = 0; i < 150; i++) add(-320 + r() * 640, -190 - r() * 260, 7, 18, 10, 46)
    for (let i = 0; i < 24; i++) add(-60 + r() * 120, -170 - r() * 12, 6, 10, 8, 18)
    return out
  }, [])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uBeat: { value: 0 } }]),
        vertexShader: towerVertex,
        fragmentShader: towerFragment,
        fog: true,
      }),
    [],
  )

  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1)
    g.setAttribute('aTop', new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => GROUND + b.h)), 1))
    return g
  }, [list])

  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((b, i) => {
      d.position.set(b.x, GROUND + b.h / 2, b.z)
      d.scale.set(b.w, b.h, b.d)
      d.updateMatrix()
      ref.current!.setMatrixAt(i, d.matrix)
      ref.current!.setColorAt(i, c.set(b.c))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.instanceColor!.needsUpdate = true
  }, [list])

  useFrame(() => {
    mat.uniforms.uBeat.value = beatNow()
  })

  return <instancedMesh ref={ref} args={[geo, mat, list.length]} frustumCulled={false} />
}

function Ground() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
        vertexShader: /* glsl */ `
          varying vec2 vXZ;
          #include <fog_pars_vertex>
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vXZ = w.xz;
            vec4 mvPosition = viewMatrix * w;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vXZ;
          #include <fog_pars_fragment>
          void main() {
            vec2 g = abs(fract(vXZ / 22.0) - 0.5);
            float road = smoothstep(0.44, 0.49, max(g.x, g.y));
            float flow = fract(vXZ.x / 30.0 + uTime * 0.3) * fract(vXZ.y / 30.0 - uTime * 0.25);
            vec3 col = vec3(0.03, 0.02, 0.06) + road * mix(vec3(1.0, 0.55, 0.15), vec3(0.2, 0.9, 1.0), step(0.5, flow)) * 0.9;
            gl_FragColor = vec4(col, 1.0);
            #include <fog_fragment>
          }`,
        fog: true,
      }),
    [],
  )
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime))
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND, -300]} material={mat}>
      <planeGeometry args={[1400, 700]} />
    </mesh>
  )
}

function CentralPark() {
  const trees = useRef<THREE.InstancedMesh>(null)
  const pts = useMemo(() => {
    const r = rng(9)
    const out: [number, number, number][] = []
    for (let i = 0; i < 420; i++) {
      const x = -55 + r() * 110
      const z = -55 - r() * 85
      if (Math.hypot((x - 10) / 18, (z + 100) / 10) < 1) continue
      out.push([x, z, 1.6 + r() * 2.2])
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    pts.forEach(([x, z, h], i) => {
      d.position.set(x, GROUND + 0.3 + h / 2, z)
      d.scale.set(1, h / 3, 1)
      d.updateMatrix()
      trees.current!.setMatrixAt(i, d.matrix)
    })
    trees.current!.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.2, -97]} material={toon('#0d2a1e')}>
        <planeGeometry args={[116, 92]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, GROUND + 0.3, -100]} scale={[18, 10, 1]} material={neon('#1fd6c2', 1.1)}>
        <circleGeometry args={[1, 40]} />
      </mesh>
      {[-30, 0, 30].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, GROUND + 0.32, -97]} material={neon('#b6ff4a', 1.4)}>
          <planeGeometry args={[0.7, 92]} />
        </mesh>
      ))}
      <instancedMesh ref={trees} args={[new THREE.ConeGeometry(1.3, 3, 7), toon('#1f6b45'), pts.length]} />
    </group>
  )
}

function River() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 16, 120, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setY(i, p.getY(i) + Math.sin(x * 0.012) * 18)
    }
    return g
  }, [])
  return <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.4, -160]} material={neon('#1d5fff', 0.9)} />
}

function MaglevLines() {
  const pods = useRef<THREE.Group>(null)
  const xLine = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 900, 8, 1, true).rotateZ(Math.PI / 2), [])
  const zLine = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 600, 8, 1, true).rotateX(Math.PI / 2), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    pods.current!.children.forEach((p, i) => {
      const k = ((t * 0.06 + i * 0.17) % 1) * 2 - 1
      if (i % 2 === 0) p.position.set(k * 420, GROUND + 22, -95)
      else p.position.set(46, GROUND + 18, -30 - ((k + 1) / 2) * 560)
    })
  })
  return (
    <group>
      <mesh geometry={xLine} position={[0, GROUND + 22, -95]} material={neon('#ffd400', 2)} />
      <mesh geometry={zLine} position={[46, GROUND + 18, -320]} material={neon('#2ef2ff', 2)} />
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} position={[0, GROUND + 22, -100 - i * 30]} material={toon('#2a2440')}>
          <boxGeometry args={[1.2, 22, 1.2]} />
        </mesh>
      ))}
      <group ref={pods}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={neon('#ffffff', 3)} rotation={i % 2 === 0 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[1.0, 9, 4, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Taipei 101: podium, tapered base, eight flared "bamboo" segments, crown and spire. */
function Taipei101() {
  const edges = useRef<THREE.LineBasicMaterial[]>([])
  const parts = useMemo(() => {
    const list: { geo: THREE.BufferGeometry; y: number }[] = []
    const frustum = (wb: number, wt: number, h: number) => {
      const g = new THREE.CylinderGeometry(wt / Math.SQRT2, wb / Math.SQRT2, h, 4, 1)
      g.rotateY(Math.PI / 4)
      return g
    }
    let y = GROUND
    const push = (g: THREE.BufferGeometry, h: number) => {
      list.push({ geo: g, y: y + h / 2 })
      y += h
    }
    push(new THREE.BoxGeometry(16, 5, 16), 5)
    push(frustum(11, 8.4, 12), 12)
    for (let i = 0; i < 8; i++) push(frustum(7.8, 9.6, 5.2), 5.2)
    push(frustum(6.4, 5.4, 2.4), 2.4)
    push(frustum(4.6, 3.8, 2.2), 2.2)
    push(frustum(3.0, 2.4, 2.0), 2.0)
    push(new THREE.CylinderGeometry(0.25, 0.5, 12, 8), 12)
    return list
  }, [])
  useFrame(() => {
    const b = beatNow()
    const hue = (b * 0.02) % 1
    edges.current.forEach((m, i) => {
      if (!m) return
      m.color.setHSL((hue + i * 0.04) % 1, 1, 0.6).multiplyScalar(2.2 + pulse(b, 3))
    })
  })
  return (
    <group position={[-92, 0, -300]}>
      {parts.map((p, i) => (
        <group key={i} position={[0, p.y, 0]}>
          <mesh geometry={p.geo} material={toon('#173a3a', { emissive: '#0a2a2a', emissiveIntensity: 0.6 })} />
          <lineSegments geometry={new THREE.EdgesGeometry(p.geo)}>
            <lineBasicMaterial ref={(m) => { if (m) edges.current[i] = m }} toneMapped={false} />
          </lineSegments>
        </group>
      ))}
      <mesh position={[0, GROUND + 77.6, 0]} material={neon("#ff2a4d", 4)}>
        <sphereGeometry args={[0.6, 8, 6]} />
      </mesh>
    </group>
  )
}

function Drones() {
  const ref = useRef<THREE.Points>(null)
  const N = 220
  const data = useMemo(() => {
    const r = rng(77)
    const base = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) base.set([-260 + r() * 520, -12 + r() * 30, -40 - r() * 300, 0.5 + r()], i * 4)
    return base
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const c = new Float32Array(N * 3)
    const pal = [new THREE.Color('#ff2a4d'), new THREE.Color('#2ef2ff'), new THREE.Color('#ffd400'), new THREE.Color('#ffffff')]
    for (let i = 0; i < N; i++) {
      const col = pal[i % pal.length]
      c.set([col.r * 3, col.g * 3, col.b * 3], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    return g
  }, [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < N; i++) {
      const sp = data[i * 4 + 3]
      const lane = i % 2 ? 1 : -1
      let x = data[i * 4] + lane * t * 9 * sp
      x = ((x + 260) % 520 + 520) % 520 - 260
      p.setXYZ(i, x, data[i * 4 + 1] + Math.sin(t * sp + i) * 0.6, data[i * 4 + 2])
    }
    p.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={1.6} vertexColors toneMapped={false} sizeAttenuation transparent opacity={0.95} />
    </points>
  )
}

function Sky() {
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
            vec3 horizon = vec3(0.75, 0.12, 0.32);
            vec3 mid = vec3(0.16, 0.05, 0.3);
            vec3 top = vec3(0.02, 0.01, 0.06);
            vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.12, h));
            col = mix(col, top, smoothstep(0.12, 0.5, h));
            col = mix(col, vec3(0.08, 0.02, 0.1), smoothstep(-0.02, -0.25, h));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  )
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[1500, 32, 16]} />
    </mesh>
  )
}

export function City() {
  return (
    <group>
      <Sky />
      <Ground />
      <Towers />
      <CentralPark />
      <River />
      <MaglevLines />
      <Taipei101 />
      <Drones />
      <NeonText text="台北AI園區" size={9} material={neon('#2ef2ff', 2.4)} position={[20, GROUND + 52, -150]} />
      <NeonText text="2033" size={6} material={neon('#ff2a8a', 2.6)} position={[20, GROUND + 42, -150]} />
    </group>
  )
}
