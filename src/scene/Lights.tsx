import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { beatNow, isChorus, pulse } from '@/audio/beat'
import { mayorHead, MAYOR_POS } from './Mayor'

export function Lights() {
  const key = useRef<THREE.DirectionalLight>(null)
  const follow = useRef<THREE.SpotLight>(null)
  const rim = useRef<THREE.SpotLight>(null)
  const strobe = useRef<THREE.PointLight>(null)
  const target = useRef(new THREE.Object3D())

  useEffect(() => {
    const t = target.current
    t.position.copy(MAYOR_POS)
    follow.current!.target = t
    rim.current!.target = t
    key.current!.target.position.set(0, 0, -3)
    key.current!.target.updateMatrixWorld()
  }, [])

  useFrame(() => {
    const b = beatNow()
    target.current.position.set(mayorHead.x, MAYOR_POS.y + 1.2, mayorHead.z)
    target.current.updateMatrixWorld()
    const chorus = isChorus(b)
    rim.current!.intensity = 120 + 140 * pulse(b, 5)
    strobe.current!.intensity = chorus && Math.floor(b) % 2 === 0 ? 220 * pulse(b, 14) : 0
  })

  return (
    <>
      <ambientLight color="#5b3d8f" intensity={0.55} />
      <hemisphereLight args={['#7a3cff', '#26070f', 0.7]} />
      <directionalLight
        ref={key}
        position={[5, 22, 14]}
        intensity={1.5}
        color="#fff0e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <spotLight ref={follow} position={[0, 13, 2]} angle={0.28} penumbra={0.5} intensity={420} distance={40} decay={1.6} color="#fff6e6" />
      <spotLight ref={rim} position={[0, 9, -17]} angle={0.4} penumbra={0.7} intensity={150} distance={30} decay={1.5} color="#ff2a4d" />
      <pointLight position={[0, 6, -14]} intensity={140} distance={26} decay={1.6} color="#2f6bff" />
      <pointLight position={[-14, 4, -14]} intensity={90} distance={18} decay={1.6} color="#ff2a4d" />
      <pointLight position={[14, 4, -14]} intensity={70} distance={18} decay={1.6} color="#ffd400" />
      <pointLight position={[0, 9, 6]} intensity={60} distance={24} decay={1.4} color="#2ef2ff" />
      <pointLight ref={strobe} position={[0, 12, -4]} intensity={0} distance={40} decay={1.2} color="#ffffff" />
    </>
  )
}
