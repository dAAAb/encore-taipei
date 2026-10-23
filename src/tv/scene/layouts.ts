/**
 * Backrooms floor plans. One is picked at random every time the room loads (or forced with
 * ?room=L0-03). Each keeps the camera lane |x| < 1.4 open from the far end to the TV at z = −1.5;
 * walls that cross the lane always leave a doorway there.
 *
 * To retire a layout, delete its entry from LAYOUTS.
 */
export type Seg = [x1: number, z1: number, x2: number, z2: number]
export type Pillar = [x: number, z: number, size: number]

export interface Layout {
  id: string
  name: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  walls: Seg[]
  pillars: Pillar[]
}

const LANE = 1.4
const DOOR = 1.5

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** A wall along x at depth z from x1 to x2, with a doorway centred on x = 0 if it crosses the lane. */
function crossWall(z: number, x1: number, x2: number, door = DOOR): Seg[] {
  if (x1 >= door || x2 <= -door) return [[x1, z, x2, z]]
  const out: Seg[] = []
  if (x1 < -door) out.push([x1, z, -door, z])
  if (x2 > door) out.push([door, z, x2, z])
  return out
}

/** A wall along z at x from z1 to z2, broken by gaps [a, b]. */
function sideWall(x: number, z1: number, z2: number, gaps: [number, number][] = []): Seg[] {
  const out: Seg[] = []
  let z = z1
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > z) out.push([x, z, x, a])
    z = Math.max(z, b)
  }
  if (z < z2) out.push([x, z, x, z2])
  return out
}

function box(x1: number, z1: number, x2: number, z2: number): Seg[] {
  return [
    [x1, z1, x2, z1],
    [x1, z2, x2, z2],
    [x1, z1, x1, z2],
    [x2, z1, x2, z2],
  ]
}

const longHall: Layout = {
  id: 'L0-01',
  name: '長廊與側室',
  bounds: { minX: -16, maxX: 16, minZ: -9, maxZ: 34 },
  walls: [
    ...[-1, 1].flatMap((s) =>
      sideWall(s * 2.4, 5, 33, [
        [9.5, 12.5],
        [18.5, 21],
        [25.5, 28],
      ]),
    ),
    ...[-1, 1].flatMap((s) => sideWall(s * 9.5, -9, 33, [[-1, 2.5], [14, 17]])),
    ...crossWall(5, -9.5, 9.5, 2.4),
    ...crossWall(-9, -9.5, 9.5, 0),
    ...[-1, 1].flatMap((s): Seg[] => [
      [s * 2.4, 15.5, s * 6.2, 15.5],
      [s * 5, 23.5, s * 9.5, 23.5],
      [s * 6.2, 9, s * 6.2, 12],
    ]),
    ...crossWall(33, -9.5, 9.5, 0),
  ],
  pillars: [
    [-4.5, -4.5, 0.6],
    [4.5, -4.5, 0.6],
    [-4.5, 1.5, 0.6],
    [4.5, 1.5, 0.6],
  ],
}

const pillarHall: Layout = (() => {
  const pillars: Pillar[] = []
  for (let x = -27.5; x <= 27.5; x += 5.5)
    for (let z = -11; z <= 33; z += 5.5) if (Math.abs(x) > 2) pillars.push([x, z, 0.7])
  return {
    id: 'L0-02',
    name: '無盡柱廳',
    bounds: { minX: -30, maxX: 30, minZ: -14, maxZ: 34 },
    walls: [
      [-30, -14, 30, -14],
      [-12, -6, -6, -6],
      [8, 9, 8, 17],
      [-17, 20, -17, 26],
      [14, 26, 21, 26],
    ],
    pillars,
  }
})()

const maze: Layout = (() => {
  const r = rng(2033)
  const walls: Seg[] = []
  for (let gx = -24; gx <= 24; gx += 4)
    for (let gz = -12; gz <= 32; gz += 4) {
      if (r() < 0.42) continue
      const len = 2 + Math.floor(r() * 3) * 2
      if (r() < 0.5) {
        if (Math.abs(gz + 1.5) < 4 && Math.abs(gx) < 6) continue
        walls.push(...crossWall(gz, gx, Math.min(gx + len, 26)))
      } else {
        if (Math.abs(gx) < LANE + 0.4) continue
        if (Math.abs(gx) < 6 && gz < 3 && gz + len > -5) continue
        walls.push([gx, gz, gx, Math.min(gz + len, 34)])
      }
    }
  walls.push(...crossWall(-12, -24, 24, 0))
  return {
    id: 'L0-03',
    name: '迷宮隔間',
    bounds: { minX: -26, maxX: 26, minZ: -13, maxZ: 34 },
    walls,
    pillars: [
      [-6, 6, 0.5],
      [10, -6, 0.5],
      [-14, 18, 0.5],
    ],
  }
})()

const suite: Layout = {
  id: 'L0-04',
  name: '連通房間',
  bounds: { minX: -14, maxX: 14, minZ: -9, maxZ: 34 },
  walls: [
    ...crossWall(22, -11, 11),
    ...crossWall(14, -11, 11),
    ...crossWall(6, -10, 10),
    ...crossWall(-9, -10, 10, 0),
    ...crossWall(33, -7, 7, 0),
    ...[-1, 1].flatMap((s) => sideWall(s * 7, 22, 33, [[27, 29]])),
    ...[-1, 1].flatMap((s) => sideWall(s * 11, 14, 22, [[16.5, 19]])),
    ...[-1, 1].flatMap((s) => sideWall(s * 6, 6, 14, [[9, 11]])),
    ...[-1, 1].flatMap((s) => sideWall(s * 10, -9, 6, [[-4, -1]])),
    ...box(-4.5, 16.5, -2.5, 19),
  ],
  pillars: [
    [-5, -4, 0.55],
    [5, -4, 0.55],
    [7.5, 18, 0.55],
  ],
}

export const LAYOUTS: Layout[] = [longHall, pillarHall, maze, suite]

export function pickLayout(exclude?: string): Layout {
  const forced = new URLSearchParams(location.search).get('room')
  const hit = LAYOUTS.find((l) => l.id === forced)
  if (hit) return hit
  const pool = LAYOUTS.length > 1 ? LAYOUTS.filter((l) => l.id !== exclude) : LAYOUTS
  return pool[Math.floor(Math.random() * pool.length)]
}
