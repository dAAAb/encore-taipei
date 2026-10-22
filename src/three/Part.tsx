import type { ThreeElements } from '@react-three/fiber'
import { forwardRef } from 'react'
import type * as THREE from 'three'
import { ink } from './toon'

type GroupProps = ThreeElements['group']

interface PartProps extends Omit<GroupProps, 'children'> {
  geo: THREE.BufferGeometry
  mat: THREE.Material | THREE.Material[]
  outline?: number
  shadow?: boolean
}

/** A mesh plus its ink hull. */
export const Part = forwardRef<THREE.Group, PartProps>(function Part(
  { geo, mat, outline = 0.02, shadow = true, ...props },
  ref,
) {
  return (
    <group ref={ref} {...props}>
      <mesh geometry={geo} material={mat} castShadow={shadow} />
      {outline > 0 && <mesh geometry={geo} material={ink(outline)} />}
    </group>
  )
})
