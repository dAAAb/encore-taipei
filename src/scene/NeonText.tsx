import type { ThreeElements } from '@react-three/fiber'
import { useMemo } from 'react'
import type * as THREE from 'three'
import { layout } from '@/three/font3d'
import { useFont3D } from '@/three/useFont3D'

type GroupProps = ThreeElements['group']

interface NeonTextProps extends Omit<GroupProps, 'children'> {
  text: string
  size: number
  material: THREE.Material | THREE.Material[]
  align?: 'center' | 'left'
}

/** Static extruded 3D text built from the shared glyph cache. */
export function NeonText({ text, size, material, align = 'center', ...props }: NeonTextProps) {
  const font = useFont3D()
  const laid = useMemo(() => (font ? layout(font, text.split('\n'), size) : null), [font, text, size])
  if (!laid) return null
  const dx = align === 'left' ? laid.width / 2 : 0
  return (
    <group {...props}>
      {laid.chars.map((c, i) =>
        c.glyph.geo ? (
          <mesh key={i} geometry={c.glyph.geo} material={material} position={[c.x + dx, c.y, 0]} scale={size} />
        ) : null,
      )}
    </group>
  )
}
