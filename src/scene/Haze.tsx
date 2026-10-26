import { useFrame, useThree } from '@react-three/fiber'
import { KernelSize } from 'postprocessing'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PeripheryHazeEffect } from '@/three/PeripheryHaze'
import { CAMERA_TARGET, maxCameraDistance } from './CameraRig'

/** Softens the frame edges into cloud as the camera pulls back toward its limit. */
export function Haze({ lowPower }: { lowPower: boolean }) {
  const effect = useMemo(() => new PeripheryHazeEffect({ kernelSize: lowPower ? KernelSize.MEDIUM : KernelSize.LARGE }), [lowPower])
  useEffect(() => () => effect.dispose(), [effect])
  const portrait = useThree((s) => s.size.width < s.size.height)
  useFrame(({ camera }) => {
    const max = maxCameraDistance(portrait)
    effect.strength = THREE.MathUtils.smoothstep(camera.position.distanceTo(CAMERA_TARGET), max * 0.68, max)
  })
  return <primitive object={effect} dispose={null} />
}
