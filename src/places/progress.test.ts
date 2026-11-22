import { describe, expect, it } from 'vitest'
import { burgFunkelfels } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type ProgressAction } from '../minigames/progress'
import { withMinigameStatus } from './progress'

const [puzzle, estimate, dilemma] = burgFunkelfels.map((g) => g.id)
const games = (...actions: ProgressAction[]) => actions.reduce(reduceProgress, initialProgress(burgFunkelfels))
const solved = (id: string, at: number): ProgressAction =>
  id === dilemma ? { type: 'decide', id, option: 0, at } : { type: 'attempt', id, correct: true, at }

describe('withMinigameStatus', () => {
  it('quest AE2: a begun minigame shows Burg Funkelfels as started', () => {
    expect(withMinigameStatus({}, games({ type: 'open', id: puzzle, at: 1 }))).toEqual({ funkelfels: 'started' })
  })

  it('quest AE3: all three minigames solved shows Burg Funkelfels as done', () => {
    const all = games(solved(puzzle, 1), solved(estimate, 2), solved(dilemma, 3))
    expect(withMinigameStatus({ funkelfels: 'started' }, all)).toEqual({ funkelfels: 'done' })
  })

  it('quest AE4: one minigame skipped, the others solved, stays started', () => {
    const skipped = games({ type: 'skip', id: puzzle, at: 1 }, solved(estimate, 2), solved(dilemma, 3))
    expect(withMinigameStatus({ funkelfels: 'started' }, skipped)).toEqual({ funkelfels: 'started' })
  })

  it('a stale stored „done“ for Burg Funkelfels never shows done without solved minigames', () => {
    expect(withMinigameStatus({ funkelfels: 'done' }, undefined)).toEqual({ funkelfels: 'started' })
    expect(withMinigameStatus({ funkelfels: 'done' }, games())).toEqual({ funkelfels: 'started' })
  })

  it('without minigame progress the stored place states stay as they are', () => {
    const places = { funkelfels: 'started', kruemelbach: 'done' } as const
    expect(withMinigameStatus(places, undefined)).toEqual(places)
    expect(withMinigameStatus(places, games())).toEqual(places)
  })

  it('other places are not touched by the minigame progress', () => {
    expect(withMinigameStatus({ kruemelbach: 'done' }, games(solved(puzzle, 1)))).toEqual({ kruemelbach: 'done', funkelfels: 'started' })
  })
})
