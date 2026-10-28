import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Suspense } from 'react'
import * as THREE from 'three'
import type { Rgb } from '@/lib/page-edge'
import { EdgeSampler } from '@/three/EdgeSampler'
import type { ChatMessage } from '../chat'
import { roofY, type Floor } from '../layout'
import { useTower } from '../store'
import { Blimp } from './Blimp'
import { Building } from './Building'
import { Drone } from './Drone'
import { FOV, Rig } from './Rig'
import { Rooftop } from './Rooftop'
import { SKY_FOG, Skyline } from './Skyline'

interface Props {
  floors: Floor[]
  messages: ChatMessage[]
  nearRoof: boolean
  lowPower: boolean
  onPick: (f: Floor) => void
  onEntered: () => void
  onLeft: () => void
  onEdgeColor?: (rgb: Rgb) => void
}

export function TowerScene({ floors, messages, nearRoof, lowPower, onPick, onEntered, onLeft, onEdgeColor }: Props) {
  const inside = useTower((s) => s.mode === 'floor')
  return (
    <Canvas
      flat
      frameloop={inside ? 'never' : 'always'}
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{ position: [9, 2.2, 46], fov: FOV, near: 0.3, far: 4000 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#05040c')
        scene.fog = new THREE.Fog(SKY_FOG, 160, 1100)
      }}
      onPointerMissed={() => useTower.getState().setHover(null)}
    >
      <Suspense fallback={null}>
        <hemisphereLight args={['#7a86ff', '#1a0c1e', 1.1]} />
        <directionalLight position={[-40, 80, 60]} intensity={1.4} color="#c9d4ff" />
        <ambientLight intensity={0.35} />
        <Skyline />
        <Building floors={floors} onPick={onPick} />
        <Rooftop y={roofY(floors.length)} messages={messages} showBubbles={nearRoof} />
        <Blimp floors={floors} onPick={onPick} />
        <Drone />
        <Rig floors={floors.length} onEntered={onEntered} onLeft={onLeft} />
        <EffectComposer multisampling={lowPower ? 0 : 4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={lowPower ? 0.8 : 1.1} radius={0.7} />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.12} />
          <Vignette eskil={false} offset={0.3} darkness={0.7} />
        </EffectComposer>
        {onEdgeColor && <EdgeSampler onColor={onEdgeColor} />}
      </Suspense>
    </Canvas>
  )
}
