import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SANITIZE } from '@/three/toon'

const NOISE = /* glsl */ `
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; } return s; }
`

/**
 * One layer of exhaust. The cylinder hangs from the nozzle; `t` runs 0 at the nozzle to 1 at the tip.
 * Turbulence, shock diamonds and a fresnel falloff make the flat mesh read as a glowing volume.
 */
function plumeMaterial(kind: 'core' | 'outer') {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uLen: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uLen;
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      ${NOISE}
      void main() {
        vT = 1.0 - uv.y;
        vec3 p = position;
        float wob = (fbm(vec3(p.xz * 1.6, vT * 4.0 - uTime * 6.0)) - 0.5) * ${kind === 'outer' ? '0.55' : '0.12'} * vT;
        p.xz *= 1.0 + wob;
        p.y *= uLen;
        vObj = vec3(p.xz, vT);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPower;
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      ${NOISE}
      void main() {
        float t = clamp(vT, 0.0, 1.0);
        float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float body = pow(facing, ${kind === 'core' ? '1.4' : '0.8'});
        float turb = fbm(vec3(vObj.xy * 2.2, t * 6.0 - uTime * 9.0));
        ${
          kind === 'core'
            ? `float diamonds = 0.55 + 0.45 * pow(0.5 + 0.5 * cos(t * 34.0 - uTime * 2.0), 6.0) * (1.0 - t);
               vec3 col = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.92, 0.6), smoothstep(0.05, 0.5, t));
               float a = body * diamonds * (1.0 - smoothstep(0.35, 1.0, t)) * (0.8 + 0.4 * turb);
               col *= 4.5;`
            : `vec3 col = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.42, 0.08), smoothstep(0.05, 0.45, t));
               col = mix(col, vec3(0.55, 0.12, 0.05), smoothstep(0.5, 1.0, t));
               float a = body * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t)) * smoothstep(0.25, 0.75, turb + 0.25 * (1.0 - t));
               col *= 2.6;`
        }
        a *= uPower;
        gl_FragColor = vec4(col * a, a);
        ${SANITIZE}
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.25, outer)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** Written by the finale director every frame (before the rocket reads it): nozzle position, burn 0–1, height climbed. */
export const launch = { base: new THREE.Vector3(), burn: 0, lift: 0, visible: true }

const SMOKE = 320
const SPARKS = 160

/** Exhaust for the launching TV: plume, nozzle flare, sparks and a smoke column with a ground blast ring. */
export function Rocket() {
  const core = useMemo(() => plumeMaterial('core'), [])
  const outer = useMemo(() => plumeMaterial('outer'), [])
  const coreGeo = useMemo(() => new THREE.CylinderGeometry(0.42, 0.06, 1, 32, 48, true).translate(0, -0.5, 0), [])
  const outerGeo = useMemo(() => new THREE.CylinderGeometry(0.85, 1.6, 1, 40, 48, true).translate(0, -0.5, 0), [])
  const plume = useRef<THREE.Group>(null)
  const flare = useRef<THREE.Sprite>(null)
  const light = useRef<THREE.PointLight>(null)
  const flareMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,255,255,1)', 'rgba(255,190,90,0.8)'),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        color: new THREE.Color(3, 2.6, 2),
      }),
    [],
  )

  const smoke = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMOKE * 3), 3))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(SMOKE).fill(-1), 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: SMOKE }, Math.random), 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife; attribute float aSeed; varying float vLife; varying float vSeed;
        void main() {
          vLife = aLife; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aLife < 0.0 ? 0.0 : (70.0 + 520.0 * pow(aLife, 0.6)) * 6.0 / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife; varying float vSeed;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          float lump = 0.75 + 0.25 * sin(atan(p.y, p.x) * 5.0 + vSeed * 30.0);
          float a = (1.0 - smoothstep(0.15 * lump, 1.0 * lump, d)) * (1.0 - vLife) * 0.5;
          vec3 hot = vec3(1.0, 0.55, 0.25);
          vec3 cold = vec3(0.78, 0.76, 0.84);
          vec3 col = mix(hot, cold, smoothstep(0.0, 0.25, vLife)) * (0.75 + 0.25 * (1.0 - p.y));
          gl_FragColor = vec4(col * a, a);
          ${SANITIZE}
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return { g, m, vel: new Float32Array(SMOKE * 3), next: 0, blasted: false }
  }, [])

  const sparks = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(SPARKS).fill(-1), 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife; varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aLife < 0.0 ? 0.0 : 60.0 * (1.0 - aLife) / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float a = exp(-dot(p, p) * 5.0) * (1.0 - vLife);
          gl_FragColor = vec4(vec3(3.0, 1.7, 0.6) * a, a);
          ${SANITIZE}
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { g, m, vel: new Float32Array(SPARKS * 3), next: 0 }
  }, [])

  const root = useRef<THREE.Group>(null)
  useFrame((s, dt) => {
    if (root.current) root.current.visible = launch.visible
    const t = s.clock.elapsedTime
    const b = launch.burn
    const base = launch.base
    const len = 5 + 9 * Math.min(1, launch.lift / 30) + Math.sin(t * 23) * 0.35

    for (const m of [core, outer]) {
      m.uniforms.uTime.value = t
      m.uniforms.uPower.value = b
      m.uniforms.uLen.value = 1
    }
    if (plume.current) {
      plume.current.position.copy(base)
      plume.current.scale.set(1 + 0.04 * Math.sin(t * 40), len * Math.max(0.05, b), 1 + 0.04 * Math.sin(t * 37))
      plume.current.visible = b > 0.01
    }
    if (flare.current) {
      flare.current.position.copy(base).add(new THREE.Vector3(0, -0.3, 0))
      flare.current.scale.setScalar(b * (3.2 + Math.sin(t * 31) * 0.4))
    }
    if (light.current) {
      light.current.position.copy(base).add(new THREE.Vector3(0, -1.5, 0))
      light.current.intensity = b * (260 + 80 * Math.sin(t * 43))
    }

    const pos = smoke.g.attributes.position as THREE.BufferAttribute
    const life = smoke.g.attributes.aLife as THREE.BufferAttribute
    const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number) => {
      const i = smoke.next++ % SMOKE
      pos.setXYZ(i, x, y, z)
      smoke.vel.set([vx, vy, vz], i * 3)
      life.setX(i, 0)
    }
    if (b > 0.05 && !smoke.blasted && launch.lift < 2) {
      smoke.blasted = true
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * Math.PI * 2
        const sp = 9 + Math.random() * 6
        emit(base.x, 1.6, base.z, Math.cos(a) * sp, 0.4 + Math.random(), Math.sin(a) * sp * 0.7)
      }
    }
    const spawn = b > 0.05 ? Math.ceil(dt * 120 * b) : 0
    for (let k = 0; k < spawn; k++) {
      const r = 0.6 + Math.random() * 0.8
      const a = Math.random() * Math.PI * 2
      emit(base.x + Math.cos(a) * r, base.y - len * (0.35 + Math.random() * 0.5), base.z + Math.sin(a) * r, Math.cos(a) * 2.5, -6 - Math.random() * 6, Math.sin(a) * 2.5)
    }
    for (let i = 0; i < SMOKE; i++) {
      const l = life.getX(i)
      if (l < 0) continue
      const nl = l + dt / 3.6
      if (nl >= 1) {
        life.setX(i, -1)
        continue
      }
      life.setX(i, nl)
      const y = pos.getY(i) + smoke.vel[i * 3 + 1] * dt
      pos.setXYZ(i, pos.getX(i) + smoke.vel[i * 3] * dt, Math.max(1.4, y), pos.getZ(i) + smoke.vel[i * 3 + 2] * dt)
      smoke.vel[i * 3] *= 0.975
      smoke.vel[i * 3 + 1] = smoke.vel[i * 3 + 1] * 0.96 + 0.25 * dt
      smoke.vel[i * 3 + 2] *= 0.975
    }
    pos.needsUpdate = true
    life.needsUpdate = true

    const sp = sparks.g.attributes.position as THREE.BufferAttribute
    const sl = sparks.g.attributes.aLife as THREE.BufferAttribute
    const sparkSpawn = b > 0.05 ? Math.ceil(dt * 90 * b) : 0
    for (let k = 0; k < sparkSpawn; k++) {
      const i = sparks.next++ % SPARKS
      sp.setXYZ(i, base.x + (Math.random() - 0.5), base.y - 0.5, base.z + (Math.random() - 0.5))
      sparks.vel.set([(Math.random() - 0.5) * 14, -14 - Math.random() * 18, (Math.random() - 0.5) * 14], i * 3)
      sl.setX(i, 0)
    }
    for (let i = 0; i < SPARKS; i++) {
      const l = sl.getX(i)
      if (l < 0) continue
      const nl = l + dt / 0.9
      if (nl >= 1) {
        sl.setX(i, -1)
        continue
      }
      sl.setX(i, nl)
      sp.setXYZ(i, sp.getX(i) + sparks.vel[i * 3] * dt, sp.getY(i) + sparks.vel[i * 3 + 1] * dt, sp.getZ(i) + sparks.vel[i * 3 + 2] * dt)
      sparks.vel[i * 3 + 1] -= 9.8 * dt
    }
    sp.needsUpdate = true
    sl.needsUpdate = true
  })

  return (
    <group ref={root}>
      <group ref={plume} visible={false}>
        <mesh geometry={outerGeo} material={outer} />
        <mesh geometry={coreGeo} material={core} />
      </group>
      <sprite ref={flare} material={flareMat} />
      <pointLight ref={light} color="#ff9a3a" distance={45} decay={1.3} intensity={0} />
      <points geometry={smoke.g} material={smoke.m} frustumCulled={false} />
      <points geometry={sparks.g} material={sparks.m} frustumCulled={false} />
    </group>
  )
}
