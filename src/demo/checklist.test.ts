import { describe, expect, it } from 'vitest'
import { burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type ProgressAction } from '../minigames/progress'
import type { Contribution } from '../collage/layout'
import { choseOwnOrder, experienced, type Facts } from './checklist'

const [puzzle, estimate] = GAMES.map((g) => g.id)
const play = (...actions: ProgressAction[]) => actions.reduce(reduceProgress, initialProgress(GAMES))
const none: Facts = { marks: [], games: GAMES, progress: undefined, placesReached: 0, contributions: [], settingsChanged: false, hasGroup: false }
const contribution = (released: boolean) => ({ released }) as Contribution

describe('choseOwnOrder', () => {
  it('is false for the stations in list order', () => {
    expect(choseOwnOrder(GAMES, play({ type: 'open', id: puzzle, at: 1 }, { type: 'attempt', id: puzzle, correct: true, at: 2 }, { type: 'open', id: estimate, at: 3 }))).toBe(false)
  })

  it('is true for a station opened before an earlier one is done', () => {
    expect(choseOwnOrder(GAMES, play({ type: 'open', id: estimate, at: 1 }))).toBe(true)
  })

  it('is true once a station is put back', () => {
    expect(choseOwnOrder(GAMES, play({ type: 'open', id: puzzle, at: 1 }, { type: 'skip', id: puzzle, at: 2 }))).toBe(true)
  })
})

describe('experienced', () => {
  it('AE3: nothing is ticked on a fresh device', () => {
    expect([...experienced(none)]).toEqual([])
  })

  it('AE3: each requirement is ticked by its own trace', () => {
    const all = experienced({
      marks: ['offline', 'teacher'],
      games: GAMES,
      progress: play({ type: 'open', id: estimate, at: 1 }, { type: 'attempt', id: estimate, correct: true, at: 2 }),
      placesReached: 1,
      contributions: [contribution(true)],
      settingsChanged: true,
      hasGroup: true,
    })
    expect([...all].sort()).toEqual(['accessibility', 'contribution', 'dashboard', 'interface', 'minigames', 'offline', 'order', 'privacy'])
  })

  it('AE5: stations solved by the demo help do not count as played minigames', () => {
    const demo = play({ type: 'demo-solve', ids: GAMES.map((g) => g.id), at: 1 })
    expect(experienced({ ...none, progress: demo }).has('minigames')).toBe(false)
  })

  it('a contribution that is not released does not tick the interface', () => {
    const ticks = experienced({ ...none, contributions: [contribution(false)] })
    expect(ticks.has('contribution')).toBe(true)
    expect(ticks.has('interface')).toBe(false)
  })

  it('two reached places show the free order', () => {
    expect(experienced({ ...none, placesReached: 2 }).has('order')).toBe(true)
  })
})
