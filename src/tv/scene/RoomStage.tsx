import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type VignetteEffect } from 'postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Montage } from '../montage/Montage'
import { Narrator } from '../montage/narrator'
import type { Era } from '../montage/segments'
import { sfx } from '../sfx'
import { Backroom, roomLight } from './Backroom'
import { createScreenMaterial, ERA_LOOK } from './screenMaterial'
import { LCD_FRONT_Z, lcdSize, SCREEN_Y, TV_POS, TvSet } from './TvSet'

export type RoomMode = 'gate' | 'intro' | 'room'

const FOV = 45
/** Post effects the director fades out so the last frame matches the flat DOM channel underneath. */
const fx = { vignette: 0.7 }

function VignetteDriver() {
  const ref = useRef<VignetteEffect>(null)
  useFrame(() => {
    if (ref.current) ref.current.darkness = fx.vignette
  })
  return <Vignette ref={ref} eskil={false} offset={0.3} darkness={0.7} />
}
const START = new THREE.Vector3(0, 1.55, 26)
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
const smooth = (x: number) => x * x * (3 - 2 * x)

/** Where the camera must sit so the LCD screen exactly fills a viewport of this aspect. */
function fillPose(aspect: number) {
  const { h } = lcdSize(aspect)
  const d = (h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 0.985
  const target = new THREE.Vector3(TV_POS.x, SCREEN_Y, TV_POS.z + LCD_FRONT_Z)
  return { pos: target.clone().add(new THREE.Vector3(0, 0, d)), target }
}

function Director({
  mode,
  quick,
  durations,
  onDone,
}: {
  mode: RoomMode
  quick: boolean
  durations: number[]
  onDone: () => void
}) {
  const { camera, size } = useThree()
  const aspect = size.width / size.height
  const montage = useMemo(() => new Montage(durations, quick), [durations, quick])
  const narrator = useMemo(() => new Narrator(montage.cues), [montage])
  const texture = useRef<THREE.CanvasTexture>(null!)
  if (!texture.current) {
    texture.current = new THREE.CanvasTexture(montage.canvas)
    texture.current.colorSpace = THREE.SRGBColorSpace
  }
  const screen = useMemo(() => createScreenMaterial(texture.current), [])
  const eraRef = useRef<Era>(quick ? 'hd' : 'film')
  const fallen = useRef(mode === 'room' ? 1 : 0)
  const clock = useRef<{ start: number | null; done: boolean; flash: number; lastEra: Era }>({ start: null, done: false, flash: 0, lastEra: eraRef.current })
  const look = useRef(new THREE.Vector3(0, 1.1, TV_POS.z))
  const pushFrom = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    montage.load()
    texture.current.image = montage.canvas
    texture.current.needsUpdate = true
    screen.uniforms.map.value = texture.current
  }, [montage, screen])

  useEffect(() => {
    if (mode !== 'intro') return
    clock.current = { start: null, done: false, flash: 0, lastEra: quick ? 'hd' : 'film' }
    eraRef.current = quick ? 'hd' : 'film'
    pushFrom.current = null
    narrator.load()
    return () => narrator.stop()
  }, [mode, quick, narrator])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = FOV
    cam.near = 0.03
    cam.updateProjectionMatrix()
    if (mode === 'gate') {
      cam.position.copy(START)
      roomLight.level = 0.12
      roomLight.flicker = 1
      fallen.current = 0
    }
    if (mode === 'room') {
      cam.position.set(0.9, 1.7, 3.6)
      roomLight.level = 1
      roomLight.flicker = 0
      fallen.current = 1
      screen.uniforms.uPower.value = 0
      eraRef.current = 'film'
    }
  }, [mode, camera, screen])

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime
    const u = screen.uniforms
    u.uTime.value = now
    const cam = camera as THREE.PerspectiveCamera

    const fog = state.scene.fog as THREE.Fog | null
    if (mode === 'gate') {
      fx.vignette = 0.7
      if (fog) {
        fog.near = 2
        fog.far = 18
      }
      cam.position.set(START.x + Math.sin(now * 0.4) * 0.05, START.y + Math.sin(now * 0.7) * 0.02, START.z)
      cam.lookAt(0, 1.15, TV_POS.z)
      u.uPower.value = 0
      return
    }
    if (mode === 'room') {
      fx.vignette = 0.55
      if (fog) {
        fog.near = 8
        fog.far = 46
      }
      cam.position.set(0.9 + Math.sin(now * 0.3) * 0.08, 1.7, 3.6)
      cam.lookAt(0, 0.35, TV_POS.z + 0.2)
      return
    }

    const c = clock.current
    if (c.start === null) c.start = now + (fallen.current > 0 ? 0.8 : 0)
    if (fallen.current > 0) fallen.current = Math.max(0, fallen.current - dt / 0.7)
    const t = now - c.start
    if (t < 0) return

    const era = montage.eraAt(t)
    if (era !== c.lastEra) {
      c.lastEra = era
      c.flash = 1
      sfx.static(0.3, 0.2)
      if (era === 'hd' && montage.setAspect(aspect)) {
        const next = new THREE.CanvasTexture(montage.canvas)
        next.colorSpace = THREE.SRGBColorSpace
        texture.current.dispose()
        texture.current = next
        u.map.value = next
      }
    }
    if (era === 'hd' && t < 0.05 && montage.setAspect(aspect)) {
      const next = new THREE.CanvasTexture(montage.canvas)
      next.colorSpace = THREE.SRGBColorSpace
      texture.current.dispose()
      texture.current = next
      u.map.value = next
    }
    eraRef.current = era
    const look_ = ERA_LOOK[era]
    u.uCurve.value = look_.uCurve
    u.uScan.value = look_.uScan
    u.uMono.value = look_.uMono
    u.uSepia.value = look_.uSepia
    u.uLines.value = look_.uLines
    c.flash = Math.max(0, c.flash - dt * 4)
    u.uFlash.value = c.flash
    u.uPower.value = Math.min(1, t / 0.45)

    montage.draw(Math.min(t, montage.total - 0.001))
    texture.current.needsUpdate = true
    narrator.update(t)

    const progress = Math.min(1, t / montage.pushAt)
    roomLight.level = 0.12 + 0.88 * smooth(progress)
    roomLight.flicker = 1 - smooth(Math.min(1, progress * 1.4))
    if (fog) {
      fog.near = 2 + 6 * roomLight.level
      fog.far = 18 + 30 * roomLight.level
    }

    const { pos: fill, target } = fillPose(aspect)
    if (t < montage.pushAt) {
      fx.vignette = 0.7
      const k = ease(progress)
      const from = quick ? new THREE.Vector3(0.9, 1.7, 3.6) : START
      const dollyEnd = new THREE.Vector3(0, 1.05, TV_POS.z + 3.1)
      cam.position.lerpVectors(from, dollyEnd, k)
      const sway = (1 - progress) * 0.045
      cam.position.x += Math.sin(now * 0.8) * sway
      cam.position.y += Math.sin(now * 1.3) * sway * 0.5
      look.current.set(0, THREE.MathUtils.lerp(1.15, SCREEN_Y, k), TV_POS.z)
      cam.lookAt(look.current)
    } else {
      if (!pushFrom.current) pushFrom.current = { pos: cam.position.clone(), look: look.current.clone() }
      const k = ease(Math.min(1, (t - montage.pushAt) / (montage.total - montage.pushAt - 0.25)))
      fx.vignette = 0.7 * (1 - k)
      cam.position.lerpVectors(pushFrom.current.pos, fill, k)
      look.current.lerpVectors(pushFrom.current.look, target, k)
      cam.lookAt(look.current)
    }

    if (t >= montage.total && !c.done) {
      c.done = true
      doneRef.current()
    }
  })

  return <TvSet screen={screen} eraRef={eraRef} aspect={aspect} fallenRef={fallen} />
}

export function RoomStage({
  mode,
  quick,
  durations,
  onDone,
  onTvClick,
  lowPower,
}: {
  mode: RoomMode
  quick: boolean
  durations: number[]
  onDone: () => void
  onTvClick?: () => void
  lowPower: boolean
}) {
  return (
    <Canvas
      flat
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{ position: START.toArray(), fov: FOV, near: 0.03, far: 80 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#14100a')
        scene.fog = new THREE.Fog('#2b2412', 6, 34)
      }}
      onPointerDown={onTvClick}
    >
      <Suspense fallback={null}>
        <Backroom />
        <Director mode={mode} quick={quick} durations={durations} onDone={onDone} />
        <EffectComposer multisampling={lowPower ? 0 : 4}>
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.7} radius={0.6} />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.12} />
          <VignetteDriver />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
