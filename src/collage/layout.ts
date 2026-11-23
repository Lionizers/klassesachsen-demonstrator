import { ITEM_BOX } from '../minigames/model'

export const CANVAS = 2048
export const PREVIEW = 512
export const CONTRIBUTIONS_KEY = 'beitraege'

/** Slider steps: each slider value is an index into its list. */
export const ARRANGEMENTS = [
  { id: 'circle', label: 'Kreis' },
  { id: 'grid', label: 'Raster' },
  { id: 'scatter', label: 'Verstreut' },
] as const
export const SIZES = [
  { factor: 0.5, label: 'klein' },
  { factor: 0.75, label: 'mittel' },
  { factor: 1, label: 'groß' },
]
export const MOODS = [
  { label: 'Sonne', background: '#f6d6a8' },
  { label: 'Wald', background: '#cfe8d0' },
  { label: 'Nacht', background: '#1f3a5f' },
]
export type Arrangement = (typeof ARRANGEMENTS)[number]['id']
export type Settings = { arrangement: number; size: number; mood: number }
/** Top left corner on the canvas and the factor from ITEM_BOX to canvas pixels. */
export type Placement = { x: number; y: number; scale: number }

/** No group name, no person: the image and these fields are all that leaves the device. */
export type ContributionMeta = { id: string; createdAt: string; type: 'item-collage'; items: string[] }
export type Contribution = ContributionMeta & { released: boolean; png: Blob; preview: Blob }

export const metaOf = ({ id, createdAt, type, items }: ContributionMeta): ContributionMeta => ({ id, createdAt, type, items })

/** FNV-1a over the item ids, so the same selection scatters the same way on every device. */
export function seedOf(ids: string[]): number {
  let hash = 2166136261
  for (const char of ids.join(',')) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619)
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `size` is a factor of the grid cell; every item stays fully on the canvas. */
export function layout(n: number, arrangement: Arrangement, size: number, seed: number): Placement[] {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const px = (CANVAS / cols) * size * 0.8
  const radius = n > 1 ? (CANVAS - px) / 2 : 0
  const random = mulberry32(seed)
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const [cx, cy] =
      arrangement === 'grid'
        ? [((i % cols) + 0.5) * (CANVAS / cols), (Math.floor(i / cols) + 0.5) * (CANVAS / rows)]
        : arrangement === 'circle'
          ? [CANVAS / 2 + radius * Math.cos(angle), CANVAS / 2 + radius * Math.sin(angle)]
          : [px / 2 + random() * (CANVAS - px), px / 2 + random() * (CANVAS - px)]
    return { x: cx - px / 2, y: cy - px / 2, scale: px / ITEM_BOX }
  })
}
