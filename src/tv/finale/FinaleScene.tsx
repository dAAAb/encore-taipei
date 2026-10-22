import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SANITIZE } from '@/three/toon'
import { createScreenMaterial } from '../scene/screenMaterial'
import { LCD_FRONT_Z, LcdTv, lcdSize, SCREEN_Y } from '../scene/TvSet'
import { sfx } from '../sfx'
import { DECK, Park } from './Park'
import { EARTH_R, SKY_POINT, Space, space, SPACE_CAM_FAR, TAIWAN_UP } from './Space'

const FOV = 45
const TV_SCALE = 3.8
const TV_AT = new THREE.Vector3(0, DECK, -0.6)

export const T = {
  collapse: 0.6,
  pulled: 3.2,
  ignite: 4.3,
  lift: 5.0,
  cloud: 9.9,
  spacePulled: 14.2,
  tilted: 17.0,
  streak: [10.4, 16.6] as const,
  faceIn: [16.3, 18.6] as const,
  lines: [18.3, 21.0] as const,
  wink: 21.6,
  credits: 23.2,
}

const PARK_SKY = new THREE.Color('#05060f')
const SPACE_SKY = new THREE.Color('#000004')
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
const seg = (t: number, a: number, b: number) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1)

function screenCard() {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 360
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 640, 360)
  grad.addColorStop(0, '#0b1a4a')
  grad.addColorStop(1, '#ff2a4d')
  g.fillStyle = grad
  g.fillRect(0, 0, 640, 360)
  g.fillStyle = '#fff7e6'
  g.font = `900 72px 'NotoTC', sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('台北安可', 320, 170)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Exhaust: flickering flame cone plus a pool of smoke puffs left behind. */
function Rocket({ tv, burn }: { tv: React.RefObject<THREE.Group | null>; burn: { current: number } }) {
  const flame = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uPower;
          varying vec2 vUv;
          void main() {
            float y = vUv.y;
            float flick = 0.85 + 0.15 * sin(uTime * 60.0 + vUv.x * 30.0);
            vec3 core = vec3(1.0, 0.95, 0.8);
            vec3 mid = vec3(1.0, 0.62, 0.12);
            vec3 edge = vec3(0.9, 0.18, 0.05);
            vec3 col = mix(edge, mid, smoothstep(0.0, 0.5, y));
            col = mix(col, core, smoothstep(0.65, 1.0, y));
            float a = smoothstep(0.0, 0.35, y) * flick * uPower;
            gl_FragColor = vec4(col * 3.2 * a, a);
            ${SANITIZE}
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const N = 220
  const smoke = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(N).fill(-1), 1))
    const vel = new Float32Array(N * 3)
    const m = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        attribute float aLife; varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aLife < 0.0 ? 0.0 : (40.0 + 260.0 * aLife) * 6.0 / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          float a = (1.0 - smoothstep(0.2, 1.0, d)) * (1.0 - vLife) * 0.55;
          gl_FragColor = vec4(vec3(0.82, 0.8, 0.86) * a, a);
          ${SANITIZE}
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return { g, m, vel, next: 0 }
  }, [])

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    const b = burn.current
    flameMat.uniforms.uTime.value = t
    flameMat.uniforms.uPower.value = b
    const tvg = tv.current
    if (!tvg) return
    const base = new THREE.Vector3(0, 0, 0)
    tvg.localToWorld(base)
    if (flame.current) {
      flame.current.position.copy(base)
      flame.current.scale.set(1 + 0.08 * Math.sin(t * 50), b * (2.6 + 0.5 * Math.sin(t * 37)), 1)
    }
    if (light.current) {
      light.current.position.copy(base)
      light.current.intensity = b * (120 + 40 * Math.sin(t * 43))
    }
    const pos = smoke.g.attributes.position as THREE.BufferAttribute
    const life = smoke.g.attributes.aLife as THREE.BufferAttribute
    const spawn = b > 0.05 ? Math.ceil(dt * 90 * b) : 0
    for (let k = 0; k < spawn; k++) {
      const i = smoke.next++ % N
      pos.setXYZ(i, base.x + (Math.random() - 0.5) * 1.2, base.y - 0.5, base.z + (Math.random() - 0.5) * 1.2)
      smoke.vel.set([(Math.random() - 0.5) * 7, -3 - Math.random() * 3, (Math.random() - 0.5) * 7], i * 3)
      life.setX(i, 0)
    }
    for (let i = 0; i < N; i++) {
      const l = life.getX(i)
      if (l < 0) continue
      const nl = l + dt / 2.6
      if (nl >= 1) {
        life.setX(i, -1)
        continue
      }
      life.setX(i, nl)
      pos.setXYZ(i, pos.getX(i) + smoke.vel[i * 3] * dt, Math.max(0.3, pos.getY(i) + smoke.vel[i * 3 + 1] * dt), pos.getZ(i) + smoke.vel[i * 3 + 2] * dt)
      smoke.vel[i * 3] *= 0.985
      smoke.vel[i * 3 + 2] *= 0.985
    }
    pos.needsUpdate = true
    life.needsUpdate = true
  })

  return (
    <group>
      <mesh ref={flame} material={flameMat}>
        <coneGeometry args={[0.9, 3, 24, 1, true]} />
      </mesh>
      <pointLight ref={light} color="#ff8a2a" distance={30} decay={1.3} intensity={0} />
      <points geometry={smoke.g} material={smoke.m} frustumCulled={false} />
    </group>
  )
}

/** Warm city lights spreading past the park, so the climb reads as the Taipei basin falling away. */
function CityLights() {
  const geo = useMemo(() => {
    const n = 5200
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 160 + Math.pow(Math.random(), 0.7) * 1700
      const grid = Math.random() < 0.6
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      pos.set([grid ? Math.round(x / 40) * 40 + (Math.random() - 0.5) * 6 : x, 0.5, grid ? z : Math.round(z / 40) * 40], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <circleGeometry args={[2200, 64]} />
        <meshBasicMaterial color="#0b0d14" />
      </mesh>
      <points geometry={geo} frustumCulled={false}>
        <pointsMaterial size={2.2} sizeAttenuation color={new THREE.Color(2.2, 1.6, 0.9)} toneMapped={false} />
      </points>
    </group>
  )
}

function Director({ onCloud, onCredits }: { onCloud: () => void; onCredits: () => void }) {
  const { camera, size, scene } = useThree()
  const aspect = size.width / size.height
  const tv = useRef<THREE.Group>(null)
  const park = useRef<THREE.Group>(null)
  const spaceGroup = useRef<THREE.Group>(null)
  const burn = useRef(0)
  const start = useRef<number | null>(null)
  const fired = useRef(new Set<string>())
  const stopRumble = useRef<((fade?: number) => void) | null>(null)
  const look = useRef(new THREE.Vector3())
  const screen = useMemo(() => {
    const m = createScreenMaterial(screenCard())
    m.uniforms.uCurve.value = 0
    m.uniforms.uScan.value = 0
    m.uniforms.uMono.value = 0
    m.uniforms.uSepia.value = 0
    m.uniforms.uPower.value = 1
    return m
  }, [])
  const once = (key: string, fn: () => void) => {
    if (fired.current.has(key)) return
    fired.current.add(key)
    fn()
  }

  useFrame((state) => {
    const now = state.clock.elapsedTime
    if (start.current === null) start.current = now
    const t = now - start.current
    const cam = camera as THREE.PerspectiveCamera
    if (cam.fov !== FOV) {
      cam.fov = FOV
      cam.updateProjectionMatrix()
    }
    const inSpace = t >= T.cloud
    if (park.current) park.current.visible = !inSpace
    if (spaceGroup.current) spaceGroup.current.visible = inSpace
    scene.background = inSpace ? SPACE_SKY : PARK_SKY
    const tvg = tv.current!

    screen.uniforms.uPower.value = 1 - seg(t, 0.05, T.collapse - 0.1)
    screen.uniforms.uBright.value = 1.1 * (1 - seg(t, T.collapse - 0.1, T.collapse + 0.15))

    const { h } = lcdSize(aspect)
    const screenCenter = new THREE.Vector3(TV_AT.x, TV_AT.y + SCREEN_Y * TV_SCALE, TV_AT.z + LCD_FRONT_Z * TV_SCALE)
    const fillDist = ((h * TV_SCALE) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 0.985
    const fill = screenCenter.clone().add(new THREE.Vector3(0, 0, fillDist))
    const wide = new THREE.Vector3(0, 6.2, 26)
    const wideLook = new THREE.Vector3(0, 3.4, -1)

    let rise = 0
    if (t >= T.lift) rise = 0.5 * 11 * (t - T.lift) ** 2
    const shake = t > T.pulled && t < T.lift + 1.5 ? (0.02 + 0.08 * seg(t, T.pulled, T.lift)) * (t > T.lift ? 1 - seg(t, T.lift, T.lift + 1.5) : 1) : 0
    tvg.position.set(TV_AT.x + (Math.random() - 0.5) * shake, TV_AT.y + rise + (Math.random() - 0.5) * shake * 0.5, TV_AT.z)
    tvg.rotation.z = t > T.lift ? Math.sin(t * 3) * 0.04 : 0
    burn.current = t < T.ignite ? 0 : Math.min(1, (t - T.ignite) / 0.5) * (inSpace ? 0 : 1)

    once('whoosh', () => sfx.whoosh(1.8, false, 0.4))
    if (t > T.pulled + 0.2) once('rumble', () => (stopRumble.current = sfx.rumble(0.25)))
    if (t > T.ignite) once('ignite', () => {
      stopRumble.current?.(0.2)
      stopRumble.current = sfx.rumble(0.7)
    })
    if (t > T.cloud - 0.5) once('cloud', () => {
      onCloud()
      stopRumble.current?.(2.2)
      sfx.whoosh(1.4, true, 0.55)
    })

    if (t < T.collapse) {
      cam.position.copy(fill)
      look.current.copy(screenCenter)
    } else if (t < T.lift) {
      const k = easeOutExpo(seg(t, T.collapse, T.pulled))
      cam.position.lerpVectors(fill, wide, k)
      cam.position.y += Math.sin(k * Math.PI) * 2.5
      look.current.lerpVectors(screenCenter, wideLook, k)
      cam.position.x += (Math.random() - 0.5) * shake * 0.6
      cam.position.y += (Math.random() - 0.5) * shake * 0.6
    } else if (!inSpace) {
      const k = ease(seg(t, T.lift, T.lift + 2.2))
      const tvY = TV_AT.y + rise
      const follow = new THREE.Vector3(0, tvY + 4 + rise * 0.12, 11 + rise * 0.05)
      cam.position.lerpVectors(wide, follow, k)
      look.current.lerpVectors(new THREE.Vector3(0, tvY + 2, 0), new THREE.Vector3(0, tvY * 0.15, -2), ease(seg(t, T.lift + 0.8, T.cloud)))
    } else {
      const k = ease(seg(t, T.cloud, T.spacePulled))
      const near = TAIWAN_UP.clone().multiplyScalar(EARTH_R * 1.22)
      cam.position.lerpVectors(near, SPACE_CAM_FAR, k)
      const tilt = ease(seg(t, T.spacePulled - 0.6, T.tilted))
      look.current.lerpVectors(new THREE.Vector3(0, 0, 0), SKY_POINT, tilt)
    }
    cam.lookAt(look.current)

    space.streak = seg(t, T.streak[0], T.streak[1]) * (t < T.streak[1] ? 1 : 2)
    space.faceAppear = seg(t, T.faceIn[0], T.faceIn[1])
    space.lineDraw = seg(t, T.lines[0], T.lines[1])
    const w = seg(t, T.wink, T.wink + 0.55)
    space.wink = Math.sin(w * Math.PI)
    space.sparkle = seg(t, T.wink + 0.15, T.wink + 1.1)
    if (t > T.wink + 0.18) once('ting', () => sfx.ting())
    if (t > T.credits) once('credits', onCredits)
  })

  return (
    <group>
      <group ref={park}>
        <Park />
        <CityLights />
        <group ref={tv} position={TV_AT} scale={TV_SCALE}>
          <LcdTv screen={screen} aspect={aspect} />
        </group>
        <Rocket tv={tv} burn={burn} />
      </group>
      <group ref={spaceGroup} visible={false}>
        <Space />
      </group>
    </group>
  )
}

export function FinaleScene({ onCloud, onCredits, lowPower }: { onCloud: () => void; onCredits: () => void; lowPower: boolean }) {
  return (
    <Canvas
      flat
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{ fov: FOV, near: 0.05, far: 4000, position: [0, 4, 6] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog('#141230', 200, 1400)
      }}
    >
      <Suspense fallback={null}>
        <Director onCloud={onCloud} onCredits={onCredits} />
        <EffectComposer multisampling={lowPower ? 0 : 4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={1.1} radius={0.7} />
          <Vignette eskil={false} offset={0.3} darkness={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
