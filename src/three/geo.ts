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
