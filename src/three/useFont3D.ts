import { useEffect, useState } from 'react'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { loadFont } from './font3d'

export function useFont3D() {
  const [font, setFont] = useState<Font | null>(null)
  useEffect(() => {
    let alive = true
    loadFont().then((f) => alive && setFont(f))
    return () => {
      alive = false
    }
  }, [])
  return font
}
