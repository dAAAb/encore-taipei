import { Canvas } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Suspense } from 'react'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { City } from './City'
import { Clouds } from './Clouds'
import { Club } from './Club'
import { Crowd } from './Crowd'
import { Haze } from './Haze'
import { Lights } from './Lights'
import { Mayor } from './Mayor'
import { MayorSpeech } from './MayorSpeech'
import { Stage } from './Stage'
import { Troupe } from './Troupe'

const CA_OFFSET = new THREE.Vector2(0.0007, 0.0005)

export function ClubScene({ lowPower }: { lowPower: boolean }) {
  return (
    <Canvas
      flat
      shadows
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{ position: [0, 9.7, 13.7], fov: 34, near: 0.5, far: 3200 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#07040c')
        scene.fog = new THREE.Fog('#2a0c34', 60, 620)
      }}
    >
      <Suspense fallback={null}>
        <Lights />
        <Club />
        <Clouds />
        <City />
        <Stage />
        <Mayor />
        <Troupe />
        <Crowd />
        <MayorSpeech />
        <CameraRig />
        <EffectComposer multisampling={lowPower ? 0 : 4}>
          <Haze lowPower={lowPower} />
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={1.15} radius={0.72} />
          <ChromaticAberration offset={CA_OFFSET} radialModulation={false} modulationOffset={0} />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.18} />
          <Vignette eskil={false} offset={0.28} darkness={0.75} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
