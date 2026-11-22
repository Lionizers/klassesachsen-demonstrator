import type { ItemArt } from '../minigames/model'

type Paths = ItemArt['paths']

/** Item art is drawn in an ITEM_BOX square; `at` places that square on the character. */
export const ITEM_BOX = 32
export const CHARACTER_VIEWBOX = '0 0 112 128'

// Drawn with the same path data as the items, so worn items line up with their `at` box.
export const BODY: Paths = [
  { d: 'M42 106h10v18H42ZM60 106h10v18H60Z', fill: '#2f4b6e' },
  { d: 'M36 70c0-10 6-14 20-14s20 4 20 14v38H36Z', fill: '#4a7fb5' },
  { d: 'M36 66l-12 22l6 3l10-16ZM76 66l8 18l-5 3l-7-14Z', fill: '#4a7fb5' },
  { d: 'M36 36a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z', fill: '#f2c9a0' },
  { d: 'M47 33a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM59 33a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM49 43q7 6 14 0l-1.5-1.5q-5.5 4-11 0Z', fill: '#1b1b1f' },
]

export function ArtPaths({ paths }: { paths: Paths }) {
  return <>{paths.map((p) => <path key={p.d} d={p.d} fill={p.fill} />)}</>
}

/** Decorative: the item name is always written next to it. */
export function ItemImage({ art, size = ITEM_BOX }: { art: ItemArt; size?: number }) {
  return (
    <svg viewBox={`0 0 ${ITEM_BOX} ${ITEM_BOX}`} width={size} height={size} aria-hidden="true" class="item">
      <ArtPaths paths={art.paths} />
    </svg>
  )
}
