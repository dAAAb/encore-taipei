import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { rbox, sphere } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'
import { DEPTH, LOBBY_H, type Floor } from '../layout'

const BASE = import.meta.env.BASE_URL
const FONT = `'NotoTC', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`
/** The blimp advertises the newest few stages, one per pass across the tower. */
const SHOWN = 3
const SWING = 40
const SPEED = 0.05
/** Overall size; the billboard has to stay readable with the camera pulled back. */
const S = 1.5
const BANNER_W = 9 * S
const BANNER_H = 1.15 * S
const SEGMENTS = 28

const createdAt = (f: Floor) => (f.kind === 'slot' && f.slot.kind === 'live' && f.slot.channel.created_at ? Date.parse(f.slot.channel.created_at) : 0)
const titleOf = (f: Floor) => (f.kind === 'slot' && f.slot.kind !== 'empty' ? f.slot.channel.title : '')

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** The billboard on the envelope: a 最新上架 header, the stage's thumbnail, and the floor number. */
function adTexture(f: Floor) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 600
  const g = c.getContext('2d')!
  const draw = (img: HTMLImageElement | null) => {
    g.fillStyle = '#0c0812'
    g.fillRect(0, 0, 1024, 600)
    if (img) {
      const s = Math.max(1024 / img.naturalWidth, 440 / img.naturalHeight)
      const w = img.naturalWidth * s
      const h = img.naturalHeight * s
      g.drawImage(img, (1024 - w) / 2, 90 + (440 - h) / 2, w, h)
    } else {
      const bg = g.createLinearGradient(0, 90, 1024, 530)
      bg.addColorStop(0, '#1f4fd1')
      bg.addColorStop(1, '#c8234a')
      g.fillStyle = bg
      g.fillRect(0, 90, 1024, 440)
      g.fillStyle = '#fff4d6'
      g.font = `900 72px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(titleOf(f).slice(0, 12), 512, 310)
    }
    g.fillStyle = '#ffd400'
    g.fillRect(0, 0, 1024, 90)
    g.fillStyle = '#0c0812'
    g.font = `900 60px ${FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('最新上架 NEW!', 36, 48)
    g.fillStyle = '#0c0812'
    g.fillRect(0, 530, 1024, 70)
    g.fillStyle = '#b6ffb0'
    g.font = `900 46px ${FONT}`
    g.fillText(`${f.number} 樓・點我進去看 ▶`, 36, 567)
    tex.needsUpdate = true
  }
  const tex = texture(c)
  draw(null)
  const sources = [`${BASE}thumbs/${f.number}.jpg`, `${BASE}og/${f.number}.jpg`, `${BASE}og/${f.number}.png`]
  const tryNext = (i: number) => {
    if (i >= sources.length) return
    const img = new Image()
    img.onload = () => draw(img)
    img.onerror = () => tryNext(i + 1)
    img.src = sources[i]
  }
  tryNext(0)
  return tex
}

/** The streamer towed behind: campaign-ribbon blue with the stage's name in white. */
function bannerTexture(f: Floor) {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 262
  const g = c.getContext('2d')!
  g.fillStyle = '#3ca6ea'
  g.fillRect(0, 0, 2048, 262)
  g.fillStyle = '#1f7ec4'
  g.fillRect(0, 0, 2048, 14)
  g.fillRect(0, 248, 2048, 14)
  g.fillStyle = '#ffffff'
  g.font = `900 132px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const text = `★ ${titleOf(f).slice(0, 14)} ★`
  const w = g.measureText(text).width
  if (w > 1960) g.scale(1960 / w, 1)
  g.fillText(text, (2048 / 2) * (w > 1960 ? w / 1960 : 1), 134)
  return texture(c)
}

/** Clicks that end a drag shouldn't count. */
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta < 8

/**
 * A blimp drifting back and forth in front of the tower, about at the visitor's height, carrying an ad for one
 * of the newest stages and towing a streamer with its name. Tapping either flies into that floor.
 */
export function Blimp({ floors, onPick }: { floors: Floor[]; onPick: (f: Floor) => void }) {
  const { camera } = useThree()
  const picks = useMemo(
    () =>
      floors
        .filter((f) => createdAt(f) > 0)
        .sort((a, b) => createdAt(b) - createdAt(a))
        .slice(0, SHOWN),
    [floors],
  )
  const [which, setWhich] = useState(0)
  const floor = picks.length ? picks[which % picks.length] : null
  const ad = useMemo(() => (floor ? adTexture(floor) : null), [floor])
  const banner = useMemo(() => (floor ? bannerTexture(floor) : null), [floor])
  useEffect(() => () => ad?.dispose(), [ad])
  useEffect(() => () => banner?.dispose(), [banner])

  const ship = useRef<THREE.Group>(null)
  const props = useRef<THREE.Mesh>(null)
  const flag = useRef<THREE.Mesh>(null)
  const rope = useRef<THREE.Mesh>(null)
  const state = useRef({ y: 0, heading: 0, dir: 1 })
  const cloth = useMemo(() => new THREE.PlaneGeometry(BANNER_W, BANNER_H, SEGMENTS, 1), [])
  const rest = useMemo(() => Float32Array.from(cloth.attributes.position.array), [cloth])
  const tail = useMemo(() => new THREE.Vector3(), [])
  const dirV = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __blimp: { ship, camera } })
  }, [camera])

  useFrame((s, dt) => {
    const g = ship.current
    if (!g || !floor) return
    const t = s.clock.elapsedTime
    const st = state.current
    const phase = t * SPEED
    const x = Math.sin(phase) * SWING
    const dir = Math.cos(phase) >= 0 ? 1 : -1
    if (dir !== st.dir) {
      st.dir = dir
      if (picks.length > 1) setWhich((n) => n + 1)
    }
    const wantY = Math.max(LOBBY_H + 6, camera.position.y + 4)
    if (!st.y) st.y = wantY
    st.y += (wantY - st.y) * Math.min(1, dt * 0.35)
    const goal = dir > 0 ? 0 : Math.PI
    st.heading += (goal - st.heading) * Math.min(1, dt * 0.9)

    g.position.set(x, st.y + Math.sin(t * 0.7) * 0.35, DEPTH / 2 + 11)
    g.rotation.set(0, st.heading, Math.sin(t * 0.5) * 0.03)
    if (props.current) props.current.rotation.x = t * 14

    // The streamer trails behind on a short rope, always facing the street, rippling more toward its free end.
    dirV.set(Math.cos(st.heading), 0, -Math.sin(st.heading))
    tail.copy(g.position).addScaledVector(dirV, -3.6 * S)
    const facing = Math.cos(st.heading) >= 0
    const f = flag.current
    if (f) {
      f.position.copy(tail).addScaledVector(dirV, -(1.2 * S + BANNER_W / 2))
      f.position.y -= 0.4 * S
      f.rotation.y = facing ? st.heading : st.heading - Math.PI
      const pos = cloth.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const bx = rest[i * 3]
        const free = facing ? (BANNER_W / 2 - bx) / BANNER_W : (bx + BANNER_W / 2) / BANNER_W
        pos.setZ(i, Math.sin((bx / S) * 0.9 - t * 4 * (facing ? -1 : 1)) * 0.35 * S * free)
        pos.setY(i, rest[i * 3 + 1] + Math.sin((bx / S) * 0.6 + t * 2.4) * 0.12 * S * free)
      }
      pos.needsUpdate = true
    }
    const r = rope.current
    if (r && f) {
      const end = f.position.clone().addScaledVector(dirV, BANNER_W / 2)
      r.position.copy(tail).add(end).multiplyScalar(0.5)
      r.scale.set(1, tail.distanceTo(end), 1)
      r.lookAt(end)
      r.rotateX(Math.PI / 2)
    }
  })

  if (!floor || !ad || !banner) return null
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (isTap(e)) onPick(floor)
    },
  }

  return (
    <group>
      <group ref={ship} {...handlers} scale={S}>
        <group scale={[3.3, 1.08, 1.08]}>
          <Part geo={sphere(1, 32, 20)} mat={toon('#f4f1ea')} outline={0.025} />
        </group>
        <mesh geometry={rbox(0.16, 2.3, 2.3, 0.06)} material={toon('#c8234a')} position={[0.2, 0, 0]} />
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
          <mesh key={a} geometry={rbox(1.3, 0.08, 0.9, 0.03)} material={toon('#ffd400')} position={[-2.9, Math.sin(a) * 0.62, Math.cos(a) * 0.62]} rotation={[a, 0, 0]} />
        ))}
        <Part geo={rbox(1.5, 0.48, 0.62, 0.12)} mat={toon('#1a1a24')} position={[0.3, -1.2, 0]} outline={0.015} />
        {[-0.35, 0, 0.35, 0.7].map((x) => (
          <mesh key={x} geometry={rbox(0.2, 0.16, 0.66, 0.04)} material={neon('#6ad0ff', 2)} position={[x + 0.05, -1.17, 0]} />
        ))}
        <mesh ref={props} position={[-0.6, -1.2, 0]}>
          <boxGeometry args={[0.04, 0.8, 0.08]} />
          <meshBasicMaterial color="#d7dbe6" transparent opacity={0.6} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} position={[0.15, 0.05, side * 1.1]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[3.1, 1.82]} />
            <meshBasicMaterial map={ad} toneMapped={false} />
          </mesh>
        ))}
        <mesh geometry={sphere(0.1, 10, 8)} material={neon('#ff2a4d', 5)} position={[3.35, 0, 0]} />
      </group>
      <mesh ref={rope}>
        <cylinderGeometry args={[0.035, 0.035, 1, 6]} />
        <meshBasicMaterial color="#2a2834" />
      </mesh>
      <mesh ref={flag} geometry={cloth} {...handlers}>
        <meshBasicMaterial map={banner} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
