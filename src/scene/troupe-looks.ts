/** Who can join the mayor on stage. Each look is drawn by the chibi rig in Troupe.tsx. */
export type Ears = 'cat' | 'shiba' | 'round' | 'deer' | 'rabbit' | 'none'
export type Tail = 'cat' | 'curl' | 'puff' | 'ringed' | 'stub' | 'none'
export type Hair = 'short' | 'bob' | 'bun' | 'perm' | 'cap' | 'helmet' | 'chef' | 'nurse' | 'band'

export interface AnimalLook {
  kind: 'animal'
  id: string
  name: string
  fur: string
  belly: string
  limbs?: string
  head?: string
  ears: Ears
  earColor?: string
  inner?: string
  muzzle: string
  nose: string
  tail: Tail
  tailColor?: string
  mask?: 'panda' | 'raccoon'
  marks?: 'deerSpots' | 'chestV' | 'leopardSpots' | 'pandaBand'
  antlers?: boolean
}

export interface CitizenLook {
  kind: 'citizen'
  id: string
  name: string
  skin: string
  hair: Hair
  hairColor: string
  top: string
  bottom: string
  skirt?: boolean
  accent?: string
  shoes: string
}

export type Look = AnimalLook | CitizenLook

export const ANIMALS: AnimalLook[] = [
  { kind: 'animal', id: 'cat', name: '橘貓', fur: '#f2a24b', belly: '#fff3e0', ears: 'cat', inner: '#ffb3b8', muzzle: '#fff3e0', nose: '#ff8fa3', tail: 'cat' },
  { kind: 'animal', id: 'shiba', name: '柴犬', fur: '#e39a4f', belly: '#fff6ea', ears: 'shiba', inner: '#fff6ea', muzzle: '#fff6ea', nose: '#2a1a14', tail: 'curl' },
  {
    kind: 'animal',
    id: 'formosan-bear',
    name: '臺灣黑熊',
    fur: '#1e1b22',
    belly: '#1e1b22',
    ears: 'round',
    muzzle: '#c9a27a',
    nose: '#0c0a0e',
    tail: 'stub',
    marks: 'chestV',
  },
  {
    kind: 'animal',
    id: 'panda',
    name: '熊貓',
    fur: '#f7f5f0',
    belly: '#f7f5f0',
    limbs: '#1b1a1f',
    ears: 'round',
    earColor: '#1b1a1f',
    muzzle: '#f7f5f0',
    nose: '#1b1a1f',
    tail: 'stub',
    mask: 'panda',
    marks: 'pandaBand',
  },
  {
    kind: 'animal',
    id: 'sika-deer',
    name: '梅花鹿',
    fur: '#b9763c',
    belly: '#f3e4c8',
    ears: 'deer',
    inner: '#f3e4c8',
    muzzle: '#f3e4c8',
    nose: '#2a1a14',
    tail: 'puff',
    tailColor: '#ffffff',
    marks: 'deerSpots',
    antlers: true,
  },
  {
    kind: 'animal',
    id: 'raccoon',
    name: '浣熊',
    fur: '#8e8a91',
    belly: '#d9d5da',
    ears: 'round',
    muzzle: '#f2f0f2',
    nose: '#1b1a1f',
    tail: 'ringed',
    mask: 'raccoon',
  },
  {
    kind: 'animal',
    id: 'leopard-cat',
    name: '石虎',
    fur: '#c9a46a',
    belly: '#f4ead2',
    ears: 'cat',
    inner: '#f4ead2',
    muzzle: '#f4ead2',
    nose: '#c96b6b',
    tail: 'cat',
    marks: 'leopardSpots',
  },
  { kind: 'animal', id: 'rabbit', name: '兔兔', fur: '#f4f1ee', belly: '#ffffff', ears: 'rabbit', inner: '#ffc2cc', muzzle: '#ffffff', nose: '#ff8fa3', tail: 'puff', tailColor: '#ffffff' },
]

export const CITIZENS: CitizenLook[] = [
  { kind: 'citizen', id: 'office', name: '上班族', skin: '#f2c9a4', hair: 'short', hairColor: '#1a1416', top: '#f6f4ef', bottom: '#3a3f4a', accent: '#d64545', shoes: '#16131a' },
  { kind: 'citizen', id: 'student', name: '高中生', skin: '#f5d2b3', hair: 'bob', hairColor: '#1a1416', top: '#f8f8f5', bottom: '#1f2d5c', skirt: true, accent: '#1f2d5c', shoes: '#16131a' },
  { kind: 'citizen', id: 'grandma', name: '阿嬤', skin: '#efc4a0', hair: 'perm', hairColor: '#c9c6cc', top: '#e86a9a', bottom: '#5b3d7a', accent: '#ffd400', shoes: '#3a2a20' },
  { kind: 'citizen', id: 'rider', name: '外送員', skin: '#e9bd96', hair: 'helmet', hairColor: '#ffd400', top: '#ffb000', bottom: '#2d2f38', accent: '#2d2f38', shoes: '#16131a' },
  { kind: 'citizen', id: 'nurse', name: '護理師', skin: '#f5d2b3', hair: 'nurse', hairColor: '#2a1c18', top: '#8fd3e8', bottom: '#8fd3e8', accent: '#ffffff', shoes: '#ffffff' },
  { kind: 'citizen', id: 'chef', name: '夜市主廚', skin: '#e9bd96', hair: 'chef', hairColor: '#ffffff', top: '#ffffff', bottom: '#2d2f38', accent: '#d64545', shoes: '#16131a' },
  { kind: 'citizen', id: 'grandpa', name: '阿伯', skin: '#e3b48c', hair: 'cap', hairColor: '#8f8c90', top: '#d64545', bottom: '#8a7a60', accent: '#ffffff', shoes: '#3a2a20' },
  { kind: 'citizen', id: 'baller', name: '籃球少年', skin: '#d9a57c', hair: 'band', hairColor: '#1a1416', top: '#ff7a1a', bottom: '#ff7a1a', accent: '#ffffff', shoes: '#ffffff' },
]

export type TroupeMode = 'solo' | 'animals' | 'citizens' | 'mix'

/** The order the "call up" button walks through; from solo it starts with everyone. */
export const TROUPE_CYCLE: Exclude<TroupeMode, 'solo'>[] = ['mix', 'animals', 'citizens']

export function troupeAfter(mode: TroupeMode): Exclude<TroupeMode, 'solo'> {
  return TROUPE_CYCLE[(TROUPE_CYCLE.indexOf(mode as Exclude<TroupeMode, 'solo'>) + 1) % TROUPE_CYCLE.length]
}

/** Button copy names who comes up next, so the label always matches what appears on stage. */
export const TROUPE_CALL: Record<Exclude<TroupeMode, 'solo'>, { full: string; short: string }> = {
  mix: { full: '大家一起上台', short: '大家上台' },
  animals: { full: '換可愛動物上台', short: '換動物' },
  citizens: { full: '換市民朋友上台', short: '換市民' },
}

function shuffle<T>(list: T[], seed: number) {
  const out = [...list]
  let s = (seed * 9301 + 49297) % 233280 || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Six dancers for the stage, in a fresh order every time. */
export function lineup(mode: TroupeMode, seed: number): Look[] {
  if (mode === 'solo') return []
  if (mode === 'animals') return shuffle(ANIMALS, seed).slice(0, 6)
  if (mode === 'citizens') return shuffle(CITIZENS, seed).slice(0, 6)
  return shuffle([...shuffle(ANIMALS, seed).slice(0, 3), ...shuffle(CITIZENS, seed + 7).slice(0, 3)], seed + 13)
}
