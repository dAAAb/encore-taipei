import * as THREE from 'three'

/**
 * Colorfigures-style shading: every lit surface falls into three flat bands
 * (dark / mid / light), outlined with a heavy ink hull.
 */

export const INK = '#0c0812'

function makeGradient(stops: number[]) {
  const data = new Uint8Array(stops.length * 4)
  stops.forEach((v, i) => data.set([v, v, v, 255], i * 4))
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export const BANDS = makeGradient([90, 170, 255])

const toonCache = new Map<string, THREE.MeshToonMaterial>()

export function toon(color: string, opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 0}|${opts.opacity ?? 1}`
  let m = toonCache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: BANDS,
      emissive: opts.emissive ?? '#000000',
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    })
    toonCache.set(key, m)
  }
  return m
}

const neonCache = new Map<string, THREE.MeshBasicMaterial>()

/** Unlit HDR colour: values above 1 feed the bloom pass. */
export function neon(color: string, intensity = 3, opacity = 1) {
  const key = `${color}|${intensity}|${opacity}`
  let m = neonCache.get(key)
  if (!m) {
    const c = new THREE.Color(color).multiplyScalar(intensity)
    m = new THREE.MeshBasicMaterial({
      color: c,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    })
    neonCache.set(key, m)
  }
  return m
}

const inkCache = new Map<number, THREE.MeshBasicMaterial>()

/** Inverted-hull outline: back faces pushed out along the normal, works for instanced meshes too. */
export function ink(thickness = 0.025) {
  let m = inkCache.get(thickness)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n transformed += normalize(normal) * ${thickness.toFixed(4)};`,
      )
    }
    m.customProgramCacheKey = () => `ink-${thickness}`
    inkCache.set(thickness, m)
  }
  return m
}

/** Flat indigo cast shadow, the Colorfigures signature. */
export function shadowCatcher(opacity = 0.55) {
  return new THREE.ShadowMaterial({ color: '#2b2f9e', opacity, transparent: true, depthWrite: false })
}
