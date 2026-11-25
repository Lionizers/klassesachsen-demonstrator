import { afterEach, describe, expect, it, vi } from 'vitest'
import { ITEM_BOX } from '../minigames/model'
import { ARRANGEMENTS, CANVAS, layout, metaOf, reviewLabel, seedOf, type Contribution } from './layout'

afterEach(() => vi.restoreAllMocks())

// Float rounding may land a fraction of a pixel past the edge.
const EPSILON = 1e-6
const inside = ({ x, y, scale }: { x: number; y: number; scale: number }) =>
  x >= -EPSILON && y >= -EPSILON && x + scale * ITEM_BOX <= CANVAS + EPSILON && y + scale * ITEM_BOX <= CANVAS + EPSILON

describe('layout', () => {
  it('AE2: the same selection and settings always give the same picture, without Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    const seed = seedOf(['turmuhr', 'drachenbesuch'])
    for (const { id } of ARRANGEMENTS) expect(layout(3, id, 1, seed)).toEqual(layout(3, id, 1, seed))
    expect(random).not.toHaveBeenCalled()
  })

  it('AE2: scatter follows the seed, so another selection scatters differently', () => {
    expect(layout(3, 'scatter', 1, seedOf(['a', 'b']))).not.toEqual(layout(3, 'scatter', 1, seedOf(['a', 'c'])))
  })

  it('AE2: arrangement and size change the placement', () => {
    const seed = seedOf(['a'])
    expect(layout(3, 'circle', 1, seed)).not.toEqual(layout(3, 'grid', 1, seed))
    expect(layout(3, 'grid', 0.5, seed)).not.toEqual(layout(3, 'grid', 1, seed))
  })

  it('AE2/AE7: every item stays on the canvas, also when it is the only one', () => {
    for (const { id } of ARRANGEMENTS) {
      for (const n of [1, 2, 3, 7]) {
        const placed = layout(n, id, 1, seedOf([String(n)]))
        expect(placed).toHaveLength(n)
        expect(placed.every(inside)).toBe(true)
      }
    }
  })
})

describe('metaOf', () => {
  it('AE4: carries exactly id, time, type and items, never a group name or the image data', () => {
    const stored = {
      id: '3f1c2a8e-7b6d-4c5e-9a1b-2c3d4e5f6a7b',
      createdAt: '2026-11-23T09:00:00.000Z',
      type: 'item-collage',
      items: ['turmuhr'],
      released: false,
      png: new Blob(),
      preview: new Blob(),
      group: 'Otter',
    } as Contribution & { group: string }
    const meta = metaOf(stored)
    expect(Object.keys(meta).sort()).toEqual(['createdAt', 'id', 'items', 'type'])
    expect(meta).toEqual({ id: stored.id, createdAt: stored.createdAt, type: 'item-collage', items: ['turmuhr'] })
    expect(JSON.stringify(meta)).not.toMatch(/Otter/)
  })
})

describe('reviewLabel', () => {
  it('tells an undecided contribution from a refused one', () => {
    expect(reviewLabel({ released: false })).toBe('wartet auf Freigabe durch die Lehrkraft')
    expect(reviewLabel({ released: false, reviewed: true })).toBe('verweigert, wird nicht ausgeliefert')
    expect(reviewLabel({ released: true, reviewed: true })).toBe('freigegeben, über /api/beitraege abrufbar')
  })
})
