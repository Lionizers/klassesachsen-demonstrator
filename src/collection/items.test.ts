import { describe, expect, it } from 'vitest'
import { burgFunkelfels } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type ProgressAction } from '../minigames/progress'
import { collected, wornOf } from './items'

const [first, second, third] = burgFunkelfels.map((g) => g.id)
const run = (...actions: ProgressAction[]) => actions.reduce(reduceProgress, initialProgress(burgFunkelfels))
const ids = (actions: ProgressAction[]) => collected(burgFunkelfels, run(...actions)).map((g) => g.id)

describe('collected', () => {
  it('AE2: a fresh start has nothing collected', () => {
    expect(ids([])).toEqual([])
  })

  it('AE1: a solved station yields exactly its own item, skipped ones none, in data order', () => {
    expect(ids([
      { type: 'attempt', id: third, correct: true, at: 1 },
      { type: 'skip', id: second, at: 2 },
      { type: 'attempt', id: first, correct: true, at: 3 },
    ])).toEqual([first, third])
  })

  it('AE4: solving the same station twice yields one item', () => {
    expect(ids([
      { type: 'attempt', id: first, correct: true, at: 1 },
      { type: 'open', id: first, at: 2 },
      { type: 'attempt', id: first, correct: true, at: 3 },
    ])).toEqual([first])
  })
})

describe('wornOf', () => {
  const items = burgFunkelfels.slice(0, 2)

  it('AE6: keeps worn items that are collected', () => {
    expect(wornOf({ worn: [second, first] }, items)).toEqual([second, first])
  })

  it('drops worn ids that are not collected, and handles nothing stored', () => {
    expect(wornOf({ worn: [third, 'removed', first] }, items)).toEqual([first])
    expect(wornOf(undefined, items)).toEqual([])
  })
})
