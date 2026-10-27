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
/** Taiwan sits just past dusk: the sun lights the far western limb. */
const SUN = new THREE.Vector3(-1, 0.25, -0.62).normalize()
const SLOGAN = ['為台北拼下一個', '黃金十年']

/** Knobs the finale director turns each frame. */
export const space = { faceAppear: 0, lineDraw: 0, meshIn: 0, slogan: 0, wink: 0, sparkle: 0, streak: -1 }

const NOISE = /* glsl */ `
  float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.07; a *= 0.5; } return s; }
`

function lonLatToSphere(lon: number, lat: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2
  const theta = ((90 - lat) / 180) * Math.PI
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
}

function Earth() {
  const [day, night, clouds] = useLoader(THREE.TextureLoader, [`${BASE}finale/earth-day.jpg`, `${BASE}finale/earth-night.jpg`, `${BASE}finale/earth-clouds.jpg`])
  for (const t of [day, night]) t.colorSpace = THREE.SRGBColorSpace
  for (const t of [day, night, clouds]) t.anisotropy = 8
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
        uniforms: { dayMap: { value: day }, nightMap: { value: night }, cloudMap: { value: clouds }, uSun: { value: SUN }, uTime: { value: 0 } },
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
          uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D cloudMap;
          uniform vec3 uSun; uniform float uTime;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main() {
            vec3 n = normalize(vN); vec3 v = normalize(vV); vec3 l = normalize(uSun);
            float ndl = dot(n, l);
            float lit = smoothstep(-0.1, 0.18, ndl);
            vec3 dayC = texture2D(dayMap, vUv).rgb;
            vec3 nightC = texture2D(nightMap, vUv).rgb;
            float cloud = texture2D(cloudMap, vUv + vec2(uTime * 0.0015, 0.0)).r;
            float water = smoothstep(0.015, 0.08, dayC.b - max(dayC.r, dayC.g));
            vec3 h = normalize(l + v);
            float glint = pow(max(dot(n, h), 0.0), 70.0) * water * lit * 2.2;
            vec3 col = dayC * (0.04 + 1.35 * max(ndl, 0.0)) * lit + vec3(1.0, 0.93, 0.8) * glint;
            col = mix(col, vec3(1.0) * (0.06 + 1.15 * max(ndl, 0.0)), cloud * 0.85 * lit);
            float lights = smoothstep(0.2, 0.85, max(nightC.r, nightC.g));
            col += (nightC * 0.35 + vec3(1.0, 0.75, 0.42) * lights * 2.2) * (1.0 - lit) * (1.0 - cloud * 0.55);
            col += vec3(1.0, 0.42, 0.16) * exp(-pow(ndl * 6.0, 2.0)) * 0.16;
            float rim = pow(1.0 - max(dot(n, v), 0.0), 3.2);
            col += mix(vec3(0.05, 0.12, 0.35), vec3(0.4, 0.68, 1.3), smoothstep(-0.25, 0.4, ndl)) * rim;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            ${SANITIZE}
          }`,
        toneMapped: false,
      }),
    [day, night, clouds],
  )
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SUN } },
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
          uniform vec3 uSun;
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(clamp(1.0 + dot(vN, vV) * 1.08, 0.0, 1.0), 3.5);
            float sunSide = smoothstep(-0.5, 0.6, dot(-vN, uSun));
            vec3 col = mix(vec3(0.08, 0.16, 0.45), vec3(0.45, 0.75, 1.5), sunSide);
            col += vec3(1.0, 0.45, 0.2) * exp(-pow(dot(-vN, uSun) * 4.0, 2.0)) * 0.5;
            gl_FragColor = vec4(col * f, f);
            ${SANITIZE}
          }`,
        toneMapped: false,
      }),
    [],
  )
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime))
  return (
    <group>
      <mesh quaternion={q} material={mat}>
        <sphereGeometry args={[EARTH_R, 128, 96]} />
      </mesh>
      <mesh material={atmo} scale={1.045}>
        <sphereGeometry args={[EARTH_R, 64, 32]} />
      </mesh>
    </group>
  )
}

/** Milky Way: a dusty band with a warm core arcing behind the face, plus a fine haze of faint stars. */
function MilkyWay() {
  const mat = useMemo(() => {
    const view = SKY_POINT.clone().sub(SPACE_CAM_FAR).normalize()
    const tilt = new THREE.Vector3(1, 0.1, 0.45).normalize()
    const normal = new THREE.Vector3().crossVectors(view, tilt).normalize()
    const core = view.clone().addScaledVector(tilt, 0.45).normalize()
    return new THREE.ShaderMaterial({
      uniforms: { uN: { value: normal }, uC: { value: core } },
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uN; uniform vec3 uC;
        varying vec3 vDir;
        ${NOISE}
        void main() {
          vec3 d = normalize(vDir);
          float b = dot(d, uN);
          float band = exp(-b * b * 22.0);
          float n = fbm(d * 4.0);
          float dust = fbm(d * 9.0 + 3.7);
          vec3 col = vec3(0.2, 0.25, 0.48) * band * pow(0.15 + 0.6 * n, 1.6);
          col *= 1.0 - 0.8 * smoothstep(0.42, 0.68, dust) * exp(-b * b * 90.0);
          float core = exp(-pow(acos(clamp(dot(d, uC), -1.0, 1.0)), 2.0) * 4.0);
          col += vec3(0.75, 0.55, 0.38) * core * band * 0.28 * (0.5 + 0.6 * n);
          vec3 g = floor(d * 420.0);
          float s = step(0.9975, h31(g)) * (0.4 + 0.6 * band);
          col += vec3(s * 0.9);
          gl_FragColor = vec4(col, 1.0);
          ${SANITIZE}
        }`,
      toneMapped: false,
    })
  }, [])
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[700, 48, 24]} />
    </mesh>
  )
}

const starVertex = /* glsl */ `
  attribute float aSize; attribute float aSeed; attribute float aAlpha; attribute vec3 aColor;
  uniform float uTime; uniform float uScale;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.75 + 0.25 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
    vAlpha = aAlpha * tw;
    vColor = aColor;
    gl_PointSize = aSize * uScale * tw / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }`
const starFragment = /* glsl */ `
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    float core = exp(-d * 9.0);
    float halo = exp(-d * 2.2) * 0.35;
    float spike = (exp(-abs(p.x) * 26.0) * exp(-p.y * p.y * 3.0) + exp(-abs(p.y) * 26.0) * exp(-p.x * p.x * 3.0)) * 0.55;
    float a = (core + halo + spike) * vAlpha;
    gl_FragColor = vec4(vColor * a * 2.2, a);
    ${SANITIZE}
  }`

function starMaterial(scale: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: scale } },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

/** Blackbody-ish tint: most stars white, some blue, some orange. */
function starTint(r: number) {
  if (r < 0.12) return new THREE.Color(0.7, 0.8, 1.15)
  if (r < 0.3) return new THREE.Color(1.0, 0.82, 0.62)
  if (r < 0.36) return new THREE.Color(1.0, 0.6, 0.45)
  return new THREE.Color(1, 0.97, 0.92)
}

function Starfield() {
  const { geo, mat } = useMemo(() => {
    const n = 6000
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const seed = new Float32Array(n)
    const alpha = new Float32Array(n)
    const color = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(520)
      pos.set([v.x, v.y, v.z], i * 3)
      size[i] = 5 + Math.pow(Math.random(), 7) * 55
      seed[i] = Math.random()
      alpha[i] = 0.3 + Math.random() * 0.7
      const c = starTint(Math.random())
      color.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    return { geo: g, mat: starMaterial(90) }
  }, [])
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime))
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/** Sample a line of text into star positions (local units, centred on the origin). */
function sloganStars(lines: string[], height: number) {
  const c = document.createElement('canvas')
  const W = 900
  const H = 420
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `900 120px 'NotoTC', 'Noto Sans TC', sans-serif`
  g.fillText(lines[0], W / 2, H * 0.27)
  g.font = `900 175px 'NotoTC', 'Noto Sans TC', sans-serif`
  g.fillText(lines[1], W / 2, H * 0.7)
  const data = g.getImageData(0, 0, W, H).data
  const out: [number, number, number][] = []
  const step = 9
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step) {
      const jx = x + ((y / step) % 2) * (step / 2)
      if (data[(y * W + Math.floor(jx)) * 4 + 3] > 140) out.push([((jx - W / 2) / H) * height, (-(y - H / 2) / H) * height, Math.random()])
    }
  return out
}

type FaceLine = [number, number, string]

/** The mayor in stars: outline and features trace in, the fine mesh fades up, one eye winks, the slogan sparkles. */
function Constellation() {
  const { size } = useThree()
  const group = useRef<THREE.Group>(null)
  const stars = face.stars as [number, number, number][]
  const lines = face.lines as FaceLine[]
  const winkSet = useMemo(() => new Set(face.wink.eye as number[]), [])
  const winkCenter = face.wink.center as [number, number]
  const [minX, maxX, minY, maxY] = face.bounds as [number, number, number, number]
  const aspect = size.width / size.height
  const wide = aspect > 1.15
  const faceW = maxX - minX
  const faceH = maxY - minY
  const sloganH = 1.9
  const sloganW = sloganH * (900 / 420)
  const totalW = wide ? faceW + 0.5 + sloganW : Math.max(faceW, sloganW)
  const totalH = wide ? Math.max(faceH, sloganH) : faceH + 0.4 + sloganH
  const viewH = 2 * 62 * Math.tan(THREE.MathUtils.degToRad(22.5)) * 0.82
  const scale = Math.min(viewH / totalH, (viewH * aspect) / totalW)
  const faceOffset = wide
    ? new THREE.Vector2(-totalW / 2 - minX, -(minY + maxY) / 2)
    : new THREE.Vector2(-(minX + maxX) / 2, totalH / 2 - maxY)
  const sloganCenter = wide ? new THREE.Vector2(totalW / 2 - sloganW / 2, 0) : new THREE.Vector2(0, -totalH / 2 + sloganH / 2)

  const built = useMemo(() => {
    const n = stars.length
    const pos = new Float32Array(n * 3)
    const sz = new Float32Array(n)
    const seed = new Float32Array(n)
    const alpha = new Float32Array(n)
    const color = new Float32Array(n * 3)
    stars.forEach((s, i) => {
      pos.set([s[0] + faceOffset.x, s[1] + faceOffset.y, 0], i * 3)
      sz[i] = 2.2 + s[2] * 4.2
      seed[i] = Math.random()
      color.set([1, 0.96, 0.86], i * 3)
    })
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    pg.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const bright = lines.filter((l) => l[2] !== 'mesh')
    const mesh = lines.filter((l) => l[2] === 'mesh')
    const lineGeo = (list: FaceLine[]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.length * 6), 3))
      return g
    }
    const lineMat = (opacity: number, color: THREE.Color) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const order = stars.map((_, i) => i).sort((a, b) => stars[b][1] - stars[a][1] + (Math.random() - 0.5) * 0.5)
    const rank = new Float32Array(n)
    order.forEach((idx, k) => (rank[idx] = k / n))

    const sl = sloganStars(SLOGAN, sloganH)
    const sp = new Float32Array(sl.length * 3)
    const ssz = new Float32Array(sl.length)
    const sseed = new Float32Array(sl.length)
    const salpha = new Float32Array(sl.length)
    const scol = new Float32Array(sl.length * 3)
    sl.forEach(([x, y, r], i) => {
      sp.set([x + sloganCenter.x, y + sloganCenter.y, 0], i * 3)
      ssz[i] = 2.2 + r * 2.8
      sseed[i] = r
      const c = r < 0.35 ? new THREE.Color(1.2, 0.95, 0.45) : new THREE.Color(1.1, 1.05, 0.9)
      scol.set([c.r, c.g, c.b], i * 3)
    })
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    sg.setAttribute('aSize', new THREE.BufferAttribute(ssz, 1))
    sg.setAttribute('aSeed', new THREE.BufferAttribute(sseed, 1))
    sg.setAttribute('aAlpha', new THREE.BufferAttribute(salpha, 1))
    sg.setAttribute('aColor', new THREE.BufferAttribute(scol, 3))
    const sloganX = sl.map(([x]) => x)
    const sMin = Math.min(...sloganX)
    const sMax = Math.max(...sloganX)

    return {
      pg,
      pm: starMaterial(110),
      bright,
      mesh,
      brightGeo: lineGeo(bright),
      meshGeo: lineGeo(mesh),
      brightMat: lineMat(0.75, new THREE.Color(0.6, 0.8, 1.7)),
      meshMat: lineMat(0.22, new THREE.Color(0.45, 0.6, 1.3)),
      rank,
      sg,
      sm: starMaterial(110),
      sloganReveal: sl.map(([x]) => (x - sMin) / Math.max(sMax - sMin, 1e-3)),
    }
    // Layout depends on the viewport only through faceOffset/sloganCenter; rebuild when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide])

  useFrame((s) => {
    const g = group.current
    if (!g) return
    g.position.copy(SKY_POINT)
    g.lookAt(s.camera.position)
    g.scale.setScalar(scale)
    const t = s.clock.elapsedTime
    built.pm.uniforms.uTime.value = t
    built.sm.uniforms.uTime.value = t
    const pos = built.pg.attributes.position as THREE.BufferAttribute
    const alpha = built.pg.attributes.aAlpha as THREE.BufferAttribute
    const squash = 1 - 0.92 * space.wink
    const wy = winkCenter[1] + faceOffset.y
    stars.forEach((st, i) => {
      let y = st[1] + faceOffset.y
      if (winkSet.has(i)) y = wy + (y - wy) * squash
      pos.setXYZ(i, st[0] + faceOffset.x, y, 0)
      alpha.setX(i, THREE.MathUtils.clamp((space.faceAppear - built.rank[i] * 0.8) * 5, 0, 1))
    })
    pos.needsUpdate = true
    alpha.needsUpdate = true
    const trace = (list: FaceLine[], geo: THREE.BufferGeometry, progress: number) => {
      const lp = geo.attributes.position as THREE.BufferAttribute
      list.forEach(([a, b], k) => {
        const p = THREE.MathUtils.clamp(progress * list.length * 1.1 - k, 0, 1)
        const ax = pos.getX(a)
        const ay = pos.getY(a)
        lp.setXYZ(k * 2, ax, ay, -0.01)
        lp.setXYZ(k * 2 + 1, ax + (pos.getX(b) - ax) * p, ay + (pos.getY(b) - ay) * p, -0.01)
      })
      lp.needsUpdate = true
    }
    trace(built.bright, built.brightGeo, space.lineDraw)
    trace(built.mesh, built.meshGeo, space.meshIn)
    built.brightMat.opacity = 0.75 * Math.min(1, space.lineDraw * 4)
    built.meshMat.opacity = 0.22 * space.meshIn
    const sa = built.sg.attributes.aAlpha as THREE.BufferAttribute
    built.sloganReveal.forEach((r, i) => sa.setX(i, THREE.MathUtils.clamp((space.slogan - r * 0.85) * 6, 0, 1)))
    sa.needsUpdate = true
  })

  return (
    <group ref={group}>
      <lineSegments geometry={built.meshGeo} material={built.meshMat} frustumCulled={false} />
      <lineSegments geometry={built.brightGeo} material={built.brightMat} frustumCulled={false} />
      <points geometry={built.pg} material={built.pm} frustumCulled={false} />
      <points geometry={built.sg} material={built.sm} frustumCulled={false} />
      <Sparkle at={[winkCenter[0] + faceOffset.x + 0.24, winkCenter[1] + faceOffset.y + 0.22]} />
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
    sp.scale.setScalar(0.05 + pop * 0.6)
    mat.rotation = s * 1.6
    mat.opacity = pop
  })
  return <sprite ref={ref} material={mat} position={[at[0], at[1], 0.02]} />
}

/** The TV, now a comet, flying from Taiwan up into the stars at a steady on-screen size. */
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
  useFrame((s) => {
    const sp = ref.current
    if (!sp) return
    const t = space.streak
    sp.visible = t >= 0 && t <= 1
    if (!sp.visible) return
    const e = t * t * (3 - 2 * t)
    sp.position.lerpVectors(from, SKY_POINT, e)
    const dist = sp.position.distanceTo(s.camera.position)
    sp.scale.setScalar(dist * (0.012 + 0.02 * Math.sin(t * Math.PI)))
  })
  return <sprite ref={ref} material={mat} />
}

export function Space() {
  return (
    <group>
      <MilkyWay />
      <Starfield />
      <Earth />
      <Streak />
      <Constellation />
    </group>
  )
}
