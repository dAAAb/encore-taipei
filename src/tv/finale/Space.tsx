import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SANITIZE } from '@/three/toon'
import face from './face.json'

const BASE = import.meta.env.BASE_URL
export const EARTH_R = 10
/** Taiwan is turned to face this direction; the space camera starts right above it. */
export const TAIWAN_UP = new THREE.Vector3(0, 0.3, 1).normalize()
export const SPACE_CAM_FAR = TAIWAN_UP.clone().multiplyScalar(34)
export const SKY_POINT = SPACE_CAM_FAR.clone().add(new THREE.Vector3(0, 60, -16))

/** Knobs the finale director turns each frame. */
export const space = { faceAppear: 0, lineDraw: 0, wink: 0, sparkle: 0, streak: -1, twinkle: 1 }

function lonLatToSphere(lon: number, lat: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2
  const theta = ((90 - lat) / 180) * Math.PI
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
}

function Earth() {
  const map = useLoader(THREE.TextureLoader, `${BASE}finale/earth-night.jpg`)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const q = useMemo(() => {
    // Taiwan onto TAIWAN_UP with north pointing up the screen (not just any roll around it).
    const frame = (n: THREE.Vector3) => {
      const north = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize()
      const east = new THREE.Vector3().crossVectors(north, n)
      return new THREE.Matrix4().makeBasis(east, north, n)
    }
    const from = frame(lonLatToSphere(121, 23.7))
    const to = frame(TAIWAN_UP)
    return new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()))
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: map } },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main() {
            vUv = uv;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D map;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main() {
            vec3 c = texture2D(map, vUv).rgb;
            float lights = smoothstep(0.25, 0.85, max(c.r, c.g));
            vec3 col = c * 0.9 + vec3(1.0, 0.78, 0.45) * lights * 1.6 + vec3(0.0, 0.015, 0.05);
            float rim = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 3.0);
            col += vec3(0.25, 0.5, 1.0) * rim * 0.8;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            ${SANITIZE}
          }`,
        toneMapped: false,
      }),
    [map],
  )
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(clamp(1.0 + dot(vN, vV) * 1.1, 0.0, 1.0), 4.0);
            gl_FragColor = vec4(vec3(0.3, 0.6, 1.4) * f, f);
            ${SANITIZE}
          }`,
        toneMapped: false,
      }),
    [],
  )
  return (
    <group>
      <mesh quaternion={q} material={mat}>
        <sphereGeometry args={[EARTH_R, 96, 64]} />
      </mesh>
      <mesh material={atmo} scale={1.06}>
        <sphereGeometry args={[EARTH_R, 64, 32]} />
      </mesh>
    </group>
  )
}

const starVertex = /* glsl */ `
  attribute float aSize; attribute float aSeed; attribute float aAlpha;
  uniform float uTime; uniform float uTwinkle; uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.75 + 0.25 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0) * uTwinkle;
    vAlpha = aAlpha * tw;
    gl_PointSize = aSize * uScale * tw / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }`
const starFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    float core = exp(-d * 9.0);
    float halo = exp(-d * 2.2) * 0.35;
    float cross = (exp(-abs(p.x) * 26.0) * exp(-p.y * p.y * 3.0) + exp(-abs(p.y) * 26.0) * exp(-p.x * p.x * 3.0)) * 0.55;
    float a = (core + halo + cross) * vAlpha;
    gl_FragColor = vec4(uColor * a * 2.2, a);
    ${SANITIZE}
  }`

function starMaterial(color: string, scale: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 }, uScale: { value: scale }, uColor: { value: new THREE.Color(color) } },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

function Starfield() {
  const { geo, mat } = useMemo(() => {
    const n = 3200
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const seed = new Float32Array(n)
    const alpha = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(520)
      pos.set([v.x, v.y, v.z], i * 3)
      size[i] = 6 + Math.pow(Math.random(), 6) * 40
      seed[i] = Math.random()
      alpha[i] = 0.35 + Math.random() * 0.65
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    return { geo: g, mat: starMaterial('#dfe8ff', 90) }
  }, [])
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime))
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

type FaceLine = [number, number, string]

/** The mayor's face drawn in stars: stars fade in, lines trace between them, then one eye winks. */
function Constellation() {
  const { size } = useThree()
  const group = useRef<THREE.Group>(null)
  const stars = face.stars as [number, number, number][]
  const lines = face.lines as FaceLine[]
  const winkSet = useMemo(() => new Set(face.wink.eye as number[]), [])
  const winkCenter = face.wink.center as [number, number]
  const scale = 15 * Math.min(1, (size.width / size.height) / 0.8)

  const { pointGeo, pointMat, lineGeo, lineMat, order } = useMemo(() => {
    const n = stars.length
    const pos = new Float32Array(n * 3)
    const sz = new Float32Array(n)
    const seed = new Float32Array(n)
    const alpha = new Float32Array(n)
    stars.forEach((s, i) => {
      pos.set([s[0], s[1], 0], i * 3)
      sz[i] = 4 + s[2] * 4.2
      seed[i] = Math.random()
    })
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines.length * 6), 3))
    const lm = new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.6), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const ord = stars.map((_, i) => i).sort((a, b) => stars[b][1] - stars[a][1] + (Math.random() - 0.5) * 0.4)
    return { pointGeo: pg, pointMat: starMaterial('#fff6dc', 110), lineGeo: lg, lineMat: lm, order: ord }
  }, [stars, lines])

  const rank = useMemo(() => {
    const r = new Float32Array(stars.length)
    order.forEach((idx, k) => (r[idx] = k / order.length))
    return r
  }, [order, stars.length])

  useFrame((s) => {
    const g = group.current
    if (!g) return
    g.position.copy(SKY_POINT)
    g.lookAt(s.camera.position)
    g.scale.setScalar(scale)
    pointMat.uniforms.uTime.value = s.clock.elapsedTime
    const pos = pointGeo.attributes.position as THREE.BufferAttribute
    const alpha = pointGeo.attributes.aAlpha as THREE.BufferAttribute
    const squash = 1 - 0.9 * space.wink
    stars.forEach((st, i) => {
      let y = st[1]
      if (winkSet.has(i)) y = winkCenter[1] + (y - winkCenter[1]) * squash
      pos.setXYZ(i, st[0], y, 0)
      alpha.setX(i, THREE.MathUtils.clamp((space.faceAppear - rank[i] * 0.8) * 5, 0, 1))
    })
    pos.needsUpdate = true
    alpha.needsUpdate = true
    const lp = lineGeo.attributes.position as THREE.BufferAttribute
    lines.forEach(([a, b], k) => {
      const p = THREE.MathUtils.clamp(space.lineDraw * lines.length * 1.15 - k * 1.0, 0, 1) || 0
      const pa = [pos.getX(a), pos.getY(a)]
      const pb = [pos.getX(b), pos.getY(b)]
      lp.setXYZ(k * 2, pa[0], pa[1], -0.01)
      lp.setXYZ(k * 2 + 1, pa[0] + (pb[0] - pa[0]) * p, pa[1] + (pb[1] - pa[1]) * p, -0.01)
    })
    lp.needsUpdate = true
    lineMat.opacity = 0.7 * Math.min(1, space.lineDraw * 4)
  })

  return (
    <group ref={group}>
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
      <points geometry={pointGeo} material={pointMat} frustumCulled={false} />
      <Sparkle at={[winkCenter[0] + 0.22, winkCenter[1] + 0.2]} />
    </group>
  )
}

/** Cartoon twinkle: a four-point star that pops beside the winking eye. */
function Sparkle({ at }: { at: [number, number] }) {
  const ref = useRef<THREE.Sprite>(null)
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.15, 'rgba(255,250,200,0.9)')
    grad.addColorStop(1, 'rgba(255,240,180,0)')
    g.fillStyle = grad
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 64 : 9
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    const tex = new THREE.CanvasTexture(c)
    return new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, color: new THREE.Color(2.4, 2.3, 1.9) })
  }, [])
  useFrame(() => {
    const s = space.sparkle
    const sp = ref.current
    if (!sp) return
    const pop = s <= 0 ? 0 : Math.sin(Math.min(1, s) * Math.PI)
    sp.scale.setScalar(0.05 + pop * 0.55)
    mat.rotation = s * 1.6
    mat.opacity = pop
  })
  return <sprite ref={ref} material={mat} position={[at[0], at[1], 0.02]} />
}

/** The TV, now a tiny comet, flying from Taiwan up into the stars. */
function Streak() {
  const ref = useRef<THREE.Sprite>(null)
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,200,120,0.8)')
    grad.addColorStop(1, 'rgba(255,120,40,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(3, 2.6, 2.2) })
  }, [])
  const from = useMemo(() => TAIWAN_UP.clone().multiplyScalar(EARTH_R * 1.02), [])
  useFrame(() => {
    const sp = ref.current
    if (!sp) return
    const t = space.streak
    sp.visible = t >= 0 && t <= 1
    if (!sp.visible) return
    const e = t * t * (3 - 2 * t)
    sp.position.lerpVectors(from, SKY_POINT, e)
    sp.scale.setScalar(0.5 + 2.5 * Math.sin(t * Math.PI))
  })
  return <sprite ref={ref} material={mat} />
}

export function Space() {
  return (
    <group>
      <Starfield />
      <Earth />
      <Streak />
      <Constellation />
    </group>
  )
}
