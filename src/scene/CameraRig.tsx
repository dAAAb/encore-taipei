import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useClub, type ViewMode } from '@/lib/store'

const TARGET = new THREE.Vector3(0, 3.5, -8.5)

const PRESETS: Record<ViewMode, { az: number; polar: number; dist: number }> = {
  front: { az: 0, polar: 1.3, dist: 23 },
  close: { az: 0.12, polar: 1.5, dist: 9.5 },
  iso: { az: 0.62, polar: 1.12, dist: 28 },
  orbit: { az: 0, polar: 1.3, dist: 27 },
}

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const view = useClub((s) => s.view)
  const nonce = useClub((s) => s.viewNonce)
  const anim = useRef<{ from: THREE.Spherical; to: THREE.Spherical; t: number } | null>(null)
  const userActive = useRef(false)
  const portrait = size.width < size.height

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = portrait ? 60 : 34
    cam.updateProjectionMatrix()
  }, [camera, portrait])

  useEffect(() => {
    const p = PRESETS[view]
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(TARGET))
    const to = new THREE.Spherical(p.dist * (portrait ? 0.82 : 1), p.polar, p.az)
    anim.current = { from, to, t: 0 }
  }, [view, nonce, camera, portrait])

  useFrame((state, dt) => {
    const c = controls.current
    if (!c) return
    if (anim.current) {
      const a = anim.current
      a.t = Math.min(1, a.t + dt / 1.3)
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(a.from.radius, a.to.radius, e),
        THREE.MathUtils.lerp(a.from.phi, a.to.phi, e),
        THREE.MathUtils.lerp(a.from.theta, a.to.theta, e),
      )
      camera.position.copy(TARGET).add(new THREE.Vector3().setFromSpherical(s))
      if (a.t >= 1) anim.current = null
    } else if (view === 'orbit' && !userActive.current) {
      const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(TARGET))
      s.theta = 0.75 * Math.sin(state.clock.elapsedTime * 0.12)
      camera.position.copy(TARGET).add(new THREE.Vector3().setFromSpherical(s))
    }
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      target={TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={7}
      maxDistance={44}
      minPolarAngle={0.7}
      maxPolarAngle={1.5}
      minAzimuthAngle={-1.05}
      maxAzimuthAngle={1.05}
      rotateSpeed={0.6}
      onStart={() => {
        userActive.current = true
        anim.current = null
      }}
      onEnd={() => {
        userActive.current = false
      }}
    />
  )
}
