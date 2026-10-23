import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useReducer } from 'react'
import * as THREE from 'three'
import { rbox } from '@/three/geo'
import { Part } from '@/three/Part'
import { neon, toon } from '@/three/toon'
import { DEPTH, FLOOR_H, LOBBY_H, WIDTH, floorY, roofY, type Floor } from '../layout'
import { useTower } from '../store'
import { floorLabel, floorTexture, lobbySign } from '../textures'
import { glassMaterial } from './glass'

const EDGE = ['#ff2a4d', '#2ef2ff', '#ffd400', '#b06bff', '#59ff7a']
const GLASS_H = FLOOR_H - 0.95

/** Clicks that end a drag shouldn't count as picking a floor. */
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta < 8

function Storey({ floor, onPick }: { floor: Floor; onPick: (f: Floor) => void }) {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const sharp = floor.kind === 'future' || (floor.kind === 'slot' && floor.slot.kind === 'empty')
  const tex = useMemo(() => floorTexture(floor, refresh), [floor])
  const front = useMemo(() => glassMaterial(tex, { seed: floor.index * 1.37 + 0.3, aspect: WIDTH / GLASS_H, sharp }), [tex, floor.index, sharp])
  const side = useMemo(() => glassMaterial(tex, { seed: floor.index * 2.11 + 1.1, aspect: DEPTH / GLASS_H, sharp, side: true }), [tex, floor.index, sharp])
  const label = useMemo(() => floorLabel(floor), [floor])
  const y = floorY(floor.index)
  const edge = EDGE[floor.index % EDGE.length]

  useEffect(() => () => {
    front.dispose()
    side.dispose()
    label.dispose()
  }, [front, side, label])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const hovered = useTower.getState().hover === floor.index ? 1 : 0
    for (const m of [front, side]) {
      m.uniforms.time.value = t
      m.uniforms.hover.value += (hovered - m.uniforms.hover.value) * 0.15
    }
  })

  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      useTower.getState().setHover(floor.index)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      if (useTower.getState().hover === floor.index) useTower.getState().setHover(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (isTap(e)) onPick(floor)
    },
  }

  const glassY = y + 0.2
  return (
    <group>
      <mesh position={[0, glassY, DEPTH / 2]} material={front} userData={{ floor: floor.index }} {...handlers}>
        <planeGeometry args={[WIDTH, GLASS_H]} />
      </mesh>
      <mesh position={[WIDTH / 2, glassY, 0]} rotation={[0, Math.PI / 2, 0]} material={side} {...handlers}>
        <planeGeometry args={[DEPTH, GLASS_H]} />
      </mesh>
      <mesh position={[-WIDTH / 2, glassY, 0]} rotation={[0, -Math.PI / 2, 0]} material={side} {...handlers}>
        <planeGeometry args={[DEPTH, GLASS_H]} />
      </mesh>
      <mesh position={[0, y - FLOOR_H / 2 + 0.33, DEPTH / 2 + 0.02]}>
        <planeGeometry args={[WIDTH, 0.56]} />
        <meshBasicMaterial map={label} toneMapped={false} />
      </mesh>
      <mesh geometry={rbox(WIDTH + 0.5, 0.12, DEPTH + 0.5, 0.03)} material={toon('#14121c')} position={[0, y - FLOOR_H / 2 + 0.02, 0]} />
      <mesh position={[0, y - FLOOR_H / 2 + 0.07, DEPTH / 2 + 0.26]} material={neon(edge, floor.kind === 'future' ? 0.6 : 2.4)}>
        <boxGeometry args={[WIDTH + 0.5, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

function Lobby() {
  const sign = useMemo(() => lobbySign(), [])
  return (
    <group>
      <Part geo={rbox(WIDTH + 1.2, 0.5, DEPTH + 1.2, 0.08)} mat={toon('#1c1a26')} position={[0, 0.25, 0]} outline={0.04} />
      <mesh position={[0, LOBBY_H / 2 + 0.3, DEPTH / 2 - 0.4]}>
        <planeGeometry args={[WIDTH - 1, LOBBY_H - 1.6]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
      </mesh>
      {[-5.6, -2.8, 0, 2.8, 5.6].map((x) => (
        <mesh key={x} geometry={rbox(0.18, LOBBY_H - 1.4, 0.18, 0.04)} material={toon('#0f0e14')} position={[x, LOBBY_H / 2 + 0.2, DEPTH / 2 - 0.2]} />
      ))}
      <mesh position={[0, 2.0, DEPTH / 2 - 0.25]}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshBasicMaterial color="#2a2018" transparent opacity={0.55} />
      </mesh>
      <Part geo={rbox(9, 0.3, 3.2, 0.06)} mat={toon('#16141e')} position={[0, LOBBY_H - 2.2, DEPTH / 2 + 1.3]} outline={0.03} />
      <mesh position={[0, LOBBY_H - 2.2 - 0.17, DEPTH / 2 + 2.85]} material={neon('#ffd400', 2.6)}>
        <boxGeometry args={[9, 0.05, 0.05]} />
      </mesh>
      <mesh position={[0, LOBBY_H - 0.7, DEPTH / 2 + 0.05]}>
        <planeGeometry args={[9.6, 1.5]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      <mesh geometry={rbox(WIDTH + 0.6, 0.3, DEPTH + 0.6, 0.05)} material={toon('#14121c')} position={[0, LOBBY_H, 0]} />
    </group>
  )
}

/** Dark steel corners running the full height, with a neon pinstripe up each front edge. */
function Frame({ floors }: { floors: number }) {
  const h = roofY(floors) - LOBBY_H
  const cy = LOBBY_H + h / 2
  return (
    <group>
      {[
        [WIDTH / 2, DEPTH / 2],
        [-WIDTH / 2, DEPTH / 2],
        [WIDTH / 2, -DEPTH / 2],
        [-WIDTH / 2, -DEPTH / 2],
      ].map(([x, z]) => (
        <Part key={`${x}${z}`} geo={rbox(0.5, h, 0.5, 0.06)} mat={toon('#101018')} position={[x, cy, z]} outline={0.03} />
      ))}
      {[WIDTH / 2 + 0.27, -WIDTH / 2 - 0.27].map((x) => (
        <mesh key={x} position={[x, cy, DEPTH / 2 + 0.27]} material={neon('#ff2a4d', 2.2)}>
          <boxGeometry args={[0.04, h, 0.04]} />
        </mesh>
      ))}
      <mesh position={[0, cy, -DEPTH / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, h]} />
        <meshBasicMaterial color="#0b0c16" />
      </mesh>
    </group>
  )
}

export function Building({ floors, onPick }: { floors: Floor[]; onPick: (f: Floor) => void }) {
  return (
    <group>
      <Lobby />
      {floors.map((f) => (
        <Storey key={`${f.index}:${f.number}:${f.kind === 'slot' ? f.slot.kind : 'future'}`} floor={f} onPick={onPick} />
      ))}
      <Frame floors={floors.length} />
    </group>
  )
}

export const towerTop = (floors: number) => new THREE.Vector3(0, roofY(floors), 0)
