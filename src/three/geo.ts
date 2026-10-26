import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const cache = new Map<string, THREE.BufferGeometry>()

function memo(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key)
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}

/**
 * Degenerate triangles (collinear outline points in glyphs and extruded shapes) get zero-length
 * normals; the shader's normalize() turns them into NaN pixels, which the bloom mip chain smears
 * into flashing black squares. Give them a sane fallback instead.
 */
export function repairNormals(geo: THREE.BufferGeometry, fallback = new THREE.Vector3(0, 0, 1)) {
  const n = geo.getAttribute('normal') as THREE.BufferAttribute | undefined
  if (!n) return geo
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i)
    const y = n.getY(i)
    const z = n.getZ(i)
    const len = Math.hypot(x, y, z)
    if (Number.isFinite(len) && len > 1e-6) {
      if (Math.abs(len - 1) > 1e-4) n.setXYZ(i, x / len, y / len, z / len)
    } else {
      n.setXYZ(i, fallback.x, fallback.y, fallback.z)
    }
  }
  n.needsUpdate = true
  return geo
}

export const rbox = (w: number, h: number, d: number, r = 0.04, seg = 2) =>
  memo(`rbox|${w}|${h}|${d}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)))

export const sphere = (r: number, w = 20, h = 14) => memo(`sph|${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h))

export const cyl = (rt: number, rb: number, h: number, seg = 20, open = false) =>
  memo(`cyl|${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open))

/** Capsule hanging down from its top end (pivot at the joint). */
export const limb = (r: number, len: number) =>
  memo(`limb|${r}|${len}`, () => {
    const g = new THREE.CapsuleGeometry(r, len, 4, 12)
    g.translate(0, -len / 2, 0)
    return g
  })

export const capsule = (r: number, len: number) => memo(`cap|${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 14))

export const torus = (r: number, tube: number, arc = Math.PI * 2, seg = 48) =>
  memo(`tor|${r}|${tube}|${arc}|${seg}`, () => new THREE.TorusGeometry(r, tube, 8, seg, arc))
