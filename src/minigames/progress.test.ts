import { describe, expect, it } from 'vitest'
import { ROLES } from '../group'
import { burgFunkelfels } from './burg-funkelfels'
import { initialProgress, placeState, reduceProgress, type Progress, type ProgressAction } from './progress'

const ids = burgFunkelfels.map((g) => g.id)
const [first, second, third] = ids
const run = (...actions: ProgressAction[]) => actions.reduce(reduceProgress, initialProgress(burgFunkelfels))
const codes = (p: Progress, id: string) => p.events.filter((e) => e.minigameId === id).map((e) => e.code)

describe('progress', () => {
  it('starts with every station open and no events', () => {
    const p = initialProgress(burgFunkelfels)
    expect(Object.keys(p.status)).toEqual(ids)
    expect(Object.values(p.status).every((s) => s === 'open')).toBe(true)
    expect(p.events).toEqual([])
    expect(placeState(p)).toBe('new')
  })

  it('AE1: a correct attempt finishes the station with start, attempt, status and end events', () => {
    const p = run({ type: 'open', id: first, at: 1 }, { type: 'attempt', id: first, correct: true, at: 2 })
    expect(p.status[first]).toBe('done')
    expect(p.events).toEqual([
      { code: 'E1', minigameId: first, at: 1, value: 'start' },
      { code: 'E3', minigameId: first, at: 2, value: 1 },
      { code: 'E2', minigameId: first, at: 2, value: 'done' },
      { code: 'E1', minigameId: first, at: 2, value: 'end' },
    ])
  })

  it('AE3: a wrong attempt keeps the station open and counts attempts', () => {
    const p = run(
      { type: 'open', id: first, at: 1 },
      { type: 'attempt', id: first, correct: false, at: 2 },
      { type: 'attempt', id: first, correct: true, at: 3 },
    )
    expect(p.events.filter((e) => e.code === 'E3').map((e) => e.value)).toEqual([1, 2])
    expect(p.status[first]).toBe('done')
    expect(run({ type: 'attempt', id: first, correct: false, at: 2 }).status[first]).toBe('open')
  })

  it('AE5: a hint request is recorded with its time', () => {
    const p = run({ type: 'hint', id: second, index: 0, at: 42 })
    expect(p.events).toEqual([{ code: 'E5', minigameId: second, at: 42, value: 1 }])
  })

  it('AE6: a skipped station stays resumable, the place stays started, any order works', () => {
    const skipped = run({ type: 'open', id: first, at: 1 }, { type: 'skip', id: first, at: 2 })
    expect(skipped.status[first]).toBe('skipped')
    expect(codes(skipped, first)).toEqual(['E1', 'E2', 'E1'])
    expect(placeState(skipped)).toBe('started')

    const finished = [
      { type: 'attempt', id: third, correct: true, at: 3 },
      { type: 'attempt', id: second, correct: true, at: 4 },
      { type: 'open', id: first, at: 5 },
      { type: 'attempt', id: first, correct: true, at: 6 },
    ] satisfies ProgressAction[]
    const done = finished.reduce(reduceProgress, skipped)
    expect(done.status).toEqual(Object.fromEntries(ids.map((id) => [id, 'done'])))
    expect(placeState(done)).toBe('done')
  })

  it('AE4: votes are counted per role position, only the outcome is kept', () => {
    const dilemma = burgFunkelfels.find((g) => g.kind === 'dilemma')!.id
    const p = run(
      { type: 'vote', id: dilemma, position: 1, at: 1 },
      { type: 'vote', id: dilemma, position: 2, at: 2 },
      { type: 'vote', id: dilemma, position: 3, at: 3 },
      { type: 'decide', id: dilemma, option: 1, at: 3 },
    )
    expect(p.status[dilemma]).toBe('done')
    expect(p.events.filter((e) => e.code === 'E7').map((e) => e.value)).toEqual([1, 2, 3])
    expect(p.events.find((e) => e.code === 'E8')).toBeDefined()
    expect(p.events.find((e) => e.code === 'E4')?.value).toBe(1)
  })

  it('stores only group-level fields: no role, person or individual vote', () => {
    const p = run(
      { type: 'open', id: first, at: 1 },
      { type: 'hint', id: first, index: 0, at: 2 },
      { type: 'attempt', id: first, correct: false, at: 3 },
      { type: 'skip', id: first, at: 4 },
      { type: 'vote', id: third, position: 1, at: 5 },
      { type: 'decide', id: third, option: 0, at: 6 },
    )
    for (const event of p.events) {
      expect(Object.keys(event).every((k) => ['code', 'minigameId', 'at', 'value'].includes(k))).toBe(true)
    }
    const json = JSON.stringify(p)
    for (const role of ROLES) expect(json).not.toContain(role)
  })
})
