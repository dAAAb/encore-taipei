import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createScreenMaterial } from '../scene/screenMaterial'
import { LCD_FRONT_Z, LcdTv, lcdSize, SCREEN_Y } from '../scene/TvSet'
import { sfx } from '../sfx'
import { DECK, Park } from './Park'
import { launch, Rocket } from './Rocket'
import { EARTH_R, SKY_POINT, Space, space, SPACE_CAM_FAR, TAIWAN_UP } from './Space'

const FOV = 45
const TV_SCALE = 3.8
const TV_AT = new THREE.Vector3(0, DECK, 0.4)

export const T = {
  collapse: 0.6,
  pulled: 3.2,
  ignite: 4.3,
  lift: 5.0,
  cloud: 9.9,
  spacePulled: 14.2,
  tilted: 17.0,
  streak: [10.4, 16.6] as const,
  faceIn: [16.3, 18.4] as const,
  lines: [18.0, 20.8] as const,
  mesh: [20.2, 21.9] as const,
  wink: 22.2,
  slogan: [22.7, 24.6] as const,
  credits: 25.2,
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
  const grad = g.createRadialGradient(320, 180, 20, 320, 180, 380)
  grad.addColorStop(0, '#f4f7ff')
  grad.addColorStop(0.55, '#b9c8f2')
  grad.addColorStop(1, '#5a6ca8')
  g.fillStyle = grad
  g.fillRect(0, 0, 640, 360)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
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

function Director({ onCloud, onCredits, lowPower }: { onCloud: () => void; onCredits: () => void; lowPower: boolean }) {
  const { camera, size, scene } = useThree()
  const aspect = size.width / size.height
  const tv = useRef<THREE.Group>(null)
  const park = useRef<THREE.Group>(null)
  const spaceGroup = useRef<THREE.Group>(null)
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
    // The station already played the switch-off on the live picture; the set arrives dark.
    m.uniforms.uPower.value = 0
    m.uniforms.uBright.value = 0
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

    const { h } = lcdSize(aspect)
    const screenCenter = new THREE.Vector3(TV_AT.x, TV_AT.y + SCREEN_Y * TV_SCALE, TV_AT.z + LCD_FRONT_Z * TV_SCALE)
    const fillDist = ((h * TV_SCALE) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 0.985
    const fill = screenCenter.clone().add(new THREE.Vector3(0, 0, fillDist))
    const wide = new THREE.Vector3(0, 6.2, 26)
    const wideLook = new THREE.Vector3(0, 3.4, -1)

    let rise = 0
    // Hover on the flame for a beat so the plume clears the deck, then accelerate away.
    if (t >= T.ignite) rise = 1.4 * ease(seg(t, T.ignite, T.lift))
    if (t >= T.lift) rise += 0.5 * 11 * (t - T.lift) ** 2
    const shake = t > T.pulled && t < T.lift + 1.5 ? (0.02 + 0.08 * seg(t, T.pulled, T.lift)) * (t > T.lift ? 1 - seg(t, T.lift, T.lift + 1.5) : 1) : 0
    tvg.position.set(TV_AT.x + (Math.random() - 0.5) * shake, TV_AT.y + rise + (Math.random() - 0.5) * shake * 0.5, TV_AT.z)
    tvg.rotation.z = t > T.lift ? Math.sin(t * 3) * 0.04 : 0
    launch.burn = t < T.ignite ? 0 : Math.min(1, (t - T.ignite) / 0.5) * (inSpace ? 0 : 1)
    launch.lift = rise
    launch.visible = !inSpace
    tvg.updateMatrixWorld(true)
    launch.base.set(0, 0.02, 0)
    tvg.localToWorld(launch.base)

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
      // Side tracking shot that rises with the TV, pitched gently down so the plume always points
      // down the screen while the park and city fall away underneath.
      const tvY = TV_AT.y + rise
      const k1 = ease(seg(t, T.lift, T.lift + 1.4))
      const side = new THREE.Vector3(15 + rise * 0.08, tvY + 1.5 + rise * 0.18, 22 + rise * 0.22)
      cam.position.lerpVectors(wide, side, k1)
      const target = new THREE.Vector3(0, tvY - 2 - rise * 0.32, TV_AT.z)
      look.current.lerpVectors(new THREE.Vector3(0, tvY + 1, TV_AT.z), target, k1)
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
    space.meshIn = seg(t, T.mesh[0], T.mesh[1])
    space.slogan = seg(t, T.slogan[0], T.slogan[1])
    const w = seg(t, T.wink, T.wink + 0.55)
    space.wink = Math.sin(w * Math.PI)
    space.sparkle = seg(t, T.wink + 0.15, T.wink + 1.1)
    if (t > T.wink + 0.18) once('ting', () => sfx.ting())
    if (t > T.credits) once('credits', onCredits)
  })

  return (
    <group>
      <group ref={park}>
        <Park lowPower={lowPower} />
        <CityLights />
        <group ref={tv} position={TV_AT} scale={TV_SCALE}>
          <LcdTv screen={screen} aspect={aspect} />
        </group>
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
        <Director onCloud={onCloud} onCredits={onCredits} lowPower={lowPower} />
        <Rocket />
        <EffectComposer multisampling={lowPower ? 0 : 4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={1.1} radius={0.7} />
          <Vignette eskil={false} offset={0.3} darkness={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
