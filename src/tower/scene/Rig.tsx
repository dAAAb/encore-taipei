import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { DEPTH, FLOOR_H, WIDTH, floorY, roofY } from '../layout'
import { useTower } from '../store'
import { rig } from './rigState'

export const FOV = 40
const GLASS_H = FLOOR_H - 0.95
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)

interface Pose {
  pos: THREE.Vector3
  look: THREE.Vector3
}

/** Where the camera sits for a given floor coordinate, zoom and orbit angle. */
function towerPose(focus: number, zoom: number, yaw: number, floors: number, out: Pose) {
  const roofness = smooth(floors - 1, floors, focus)
  const fy = floorY(Math.min(focus, floors - 0.5))
  const dist = 15 + Math.pow(zoom, 1.35) * 118 - roofness * 3
  const top = roofY(floors)
  const mid = top / 2
  const lookY = THREE.MathUtils.lerp(fy, mid, zoom * 0.55) * (1 - roofness) + (top + 1.5) * roofness
  const r = dist + DEPTH / 2
  const camY = Math.max(1.6, lookY + dist * (0.05 + roofness * 0.42))
  out.pos.set(Math.sin(yaw) * r, camY, Math.cos(yaw) * r)
  out.look.set(0, lookY, 0)
  return out
}

/** Close enough that the floor's glass covers the whole screen, whatever its aspect ratio. */
function fillPose(index: number, aspect: number, out: Pose) {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const d = Math.min(GLASS_H / (2 * t), WIDTH / (2 * t * aspect)) * 0.97
  const y = floorY(index) + 0.2
  out.pos.set(0, y, DEPTH / 2 + d)
  out.look.set(0, y, DEPTH / 2)
  return out
}

function gatePose(floors: number, aspect: number, out: Pose) {
  out.pos.set(9, 2.2, 46 + Math.max(0, 1 - aspect) * 70)
  out.look.set(0, roofY(floors) * 0.62, 0)
  return out
}

const pose = () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() })

/** Camera and input: scroll/drag flies up and down, pinch/ctrl-wheel zooms, horizontal drag orbits. */
export function Rig({ floors, onEntered, onLeft }: { floors: number; onEntered: () => void; onLeft: () => void }) {
  const { camera, gl, size } = useThree()
  const cur = useRef(pose())
  const want = useRef(pose())
  const from = useRef(pose())
  const to = useRef(pose())
  const tween = useRef<{ t: number; dur: number; kind: 'takeoff' | 'enter' | 'leave' } | null>(null)
  const prevMode = useRef(useTower.getState().mode)
  const yawPrev = useRef(0)
  const started = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const live = () => useTower.getState().mode === 'tower'
    const fly = (dFloors: number) => {
      const s = useTower.getState()
      s.setTarget(THREE.MathUtils.clamp(s.target + dFloors, -0.4, floors))
      rig.lastInput = performance.now()
    }

    const onWheel = (e: WheelEvent) => {
      if (!live()) return
      e.preventDefault()
      const s = useTower.getState()
      if (e.ctrlKey) s.setZoom(s.zoom + e.deltaY * 0.01)
      else fly(-e.deltaY * 0.0045 * (1 + s.zoom * 2.5))
      rig.lastInput = performance.now()
    }
    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p || !live()) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      const s = useTower.getState()
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0) s.setZoom(s.zoom - (d - pinch) * 0.004)
        pinch = d
        rig.lastInput = performance.now()
        return
      }
      fly((dy / el.clientHeight) * (3 + s.zoom * 9))
      s.setYaw(s.yaw - dx * 0.004)
    }
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [gl, floors])

  useFrame((_, dt) => {
    const s = useTower.getState()
    const aspect = size.width / size.height
    const c = cur.current

    if (!started.current) {
      started.current = true
      gatePose(floors, aspect, c)
      rig.focus = s.target
    }

    if (s.mode !== prevMode.current) {
      const was = prevMode.current
      prevMode.current = s.mode
      from.current.pos.copy(c.pos)
      from.current.look.copy(c.look)
      if (was === 'gate' && s.mode === 'tower') tween.current = { t: 0, dur: 3.2, kind: 'takeoff' }
      if (s.mode === 'entering') tween.current = { t: 0, dur: 1.5, kind: 'enter' }
      if (s.mode === 'leaving') {
        fillPose(s.active, aspect, from.current)
        rig.focus = Math.min(s.active, floors)
        tween.current = { t: 0, dur: 1.3, kind: 'leave' }
      }
    }

    // settle on the nearest floor once the visitor stops steering
    if (s.mode === 'tower' && performance.now() - rig.lastInput > 650) {
      const snap = THREE.MathUtils.clamp(Math.round(s.target), 0, floors)
      if (Math.abs(snap - s.target) > 1e-3) useTower.setState({ target: THREE.MathUtils.lerp(s.target, snap, Math.min(1, dt * 6)) })
    }

    rig.focus += (s.target - rig.focus) * Math.min(1, dt * 3.2)
    rig.yawSpeed = (s.yaw - yawPrev.current) / Math.max(dt, 1e-3)
    yawPrev.current = s.yaw

    if (s.mode === 'gate') {
      gatePose(floors, aspect, want.current)
      want.current.pos.x += Math.sin(performance.now() / 4000) * 2
      c.pos.lerp(want.current.pos, Math.min(1, dt * 2))
      c.look.lerp(want.current.look, Math.min(1, dt * 2))
      rig.droneVisible = false
    } else if (tween.current) {
      const tw = tween.current
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      const k = ease(tw.t)
      if (tw.kind === 'enter') fillPose(s.active, aspect, to.current)
      else towerPose(rig.focus, s.zoom, s.yaw, floors, to.current)
      c.pos.lerpVectors(from.current.pos, to.current.pos, k)
      c.look.lerpVectors(from.current.look, to.current.look, k)
      if (tw.kind === 'takeoff') c.pos.y += Math.sin(k * Math.PI) * 6
      rig.droneVisible = true
      rig.dive = tw.kind === 'enter' ? smooth(0.15, 1, tw.t) : tw.kind === 'leave' ? 1 - smooth(0.2, 0.8, tw.t) : 0
      if (tw.t >= 1) {
        tween.current = null
        if (tw.kind === 'enter') onEntered()
        if (tw.kind === 'leave') onLeft()
      }
    } else if (s.mode === 'floor') {
      fillPose(s.active, aspect, c)
      rig.dive = 1
    } else {
      towerPose(rig.focus, s.zoom, s.yaw, floors, want.current)
      const k = Math.min(1, dt * 4)
      c.pos.lerp(want.current.pos, k)
      c.look.lerp(want.current.look, k)
      rig.dive = 0
      rig.droneVisible = true
    }

    const cam = camera as THREE.PerspectiveCamera
    if (cam.fov !== FOV) {
      cam.fov = FOV
      cam.updateProjectionMatrix()
    }
    cam.position.copy(c.pos)
    cam.lookAt(c.look)
  })

  return null
}
