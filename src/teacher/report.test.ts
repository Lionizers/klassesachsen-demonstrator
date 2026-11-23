import { describe, expect, it } from 'vitest'
import { burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type GameEvent, type ProgressAction } from '../minigames/progress'
import { DEMO_GROUPS } from './demo'
import { INDICATORS, LEVELS, RETENTION_MS, activeMinutes, indicators, isExpired, questCompletedAt } from './report'

const [a, b, c] = GAMES.map((g) => g.id)
const MIN = 60_000

/** One station: opened at `at`, `hints` hints, `attempts` attempts with the last one correct, finished `minutes` later. */
function station(id: string, at: number, { attempts = 1, hints = 0, minutes = 1 } = {}): ProgressAction[] {
  const end = at + minutes * MIN
  return [
    { type: 'open', id, at },
    ...Array.from({ length: hints }, (_, i) => ({ type: 'hint' as const, id, index: i, at })),
    ...Array.from({ length: attempts }, (_, i) => ({ type: 'attempt' as const, id, correct: i === attempts - 1, at: end })),
  ]
}
const play = (...actions: ProgressAction[]) => actions.reduce(reduceProgress, initialProgress(GAMES))
const events = (...actions: ProgressAction[]) => play(...actions).events
const level = (evs: GameEvent[], id: string) => indicators(evs, GAMES).find((i) => i.id === id)!.level

describe('indicators (Beispielregel)', () => {
  it('names the three indicators and five ordered levels', () => {
    expect(INDICATORS.map((i) => i.name)).toEqual(['Teamleistung', 'Problemlösung', 'Beteiligung'])
    expect(LEVELS).toEqual(['Einblick gewinnen', 'Kennen', 'Anwenden', 'Beurteilen/Sich positionieren', 'Gestalten'])
    for (const i of INDICATORS) expect(i.descriptions).toHaveLength(5)
    for (const i of indicators([], GAMES)) expect(i.rule).toMatch(/^Beispielregel: /)
  })

  it('Teamleistung 5: every station done, none skipped', () => {
    expect(level(events(...station(a, 0), ...station(b, 0), ...station(c, 0)), 'team')).toBe(5)
  })
  it('Teamleistung 4: every station done after a skip', () => {
    expect(level(events({ type: 'skip', id: a, at: 0 }, ...station(a, 0), ...station(b, 0), ...station(c, 0)), 'team')).toBe(4)
  })
  it('Teamleistung 3: at least half of the stations done', () => {
    expect(level(events(...station(a, 0), ...station(b, 0)), 'team')).toBe(3)
  })
  it('Teamleistung 2: one station done', () => {
    expect(level(events(...station(a, 0)), 'team')).toBe(2)
  })
  it('Teamleistung 1: nothing done', () => {
    expect(level(events({ type: 'open', id: a, at: 0 }), 'team')).toBe(1)
  })

  it('Problemlösung 5: solved without hint and at the first attempt', () => {
    expect(level(events(...station(a, 0)), 'problem')).toBe(5)
  })
  it('Problemlösung 4: solved without hint after several attempts', () => {
    expect(level(events(...station(a, 0, { attempts: 2 })), 'problem')).toBe(4)
  })
  it('Problemlösung 3: at most one hint per solved station', () => {
    expect(level(events(...station(a, 0, { hints: 1 })), 'problem')).toBe(3)
  })
  it('Problemlösung 2: solved with more hints', () => {
    expect(level(events(...station(a, 0, { hints: 2 })), 'problem')).toBe(2)
  })
  it('Problemlösung 1: nothing solved', () => {
    expect(level(events({ type: 'open', id: a, at: 0 }, { type: 'hint', id: a, index: 0, at: 0 }), 'problem')).toBe(1)
  })

  const votes = (id: string): ProgressAction[] => [1, 2, 3].map((position) => ({ type: 'vote', id, position, at: 0 }))
  it('Beteiligung 5: all three positions voted and at least 10 minutes active', () => {
    expect(level(events(...votes(c), ...station(a, 0, { minutes: 10 })), 'participation')).toBe(5)
  })
  it('Beteiligung 4: all three positions voted', () => {
    expect(level(events(...votes(c), ...station(a, 0, { minutes: 9 })), 'participation')).toBe(4)
  })
  it('Beteiligung 3: at least 10 minutes active', () => {
    expect(level(events(...station(a, 0, { minutes: 10 })), 'participation')).toBe(3)
  })
  it('Beteiligung 2: a station opened', () => {
    expect(level(events({ type: 'open', id: a, at: 0 }), 'participation')).toBe(2)
  })
  it('Beteiligung 1: nothing opened', () => {
    expect(level([], 'participation')).toBe(1)
  })

  it('E9: active time sums the E1 start/end pairs and ignores an open start', () => {
    const evs = events(...station(a, 0, { minutes: 4 }), ...station(b, 100 * MIN, { minutes: 3 }), { type: 'open', id: c, at: 200 * MIN })
    expect(activeMinutes(evs)).toBe(7)
  })
})

describe('retention', () => {
  const done = play(...station(a, 0), ...station(b, 5 * MIN), ...station(c, 10 * MIN))
  const completed = 11 * MIN

  it('the quest is completed by the event that finished the last station', () => {
    expect(questCompletedAt(done, GAMES)).toBe(completed)
    expect(questCompletedAt(play(...station(a, 0)), GAMES)).toBeUndefined()
  })

  it('AE8: group data is kept exactly 12 weeks after completion and expires one millisecond later', () => {
    expect(RETENTION_MS).toBe(84 * 24 * 60 * MIN)
    expect(isExpired(done, GAMES, completed + RETENTION_MS)).toBe(false)
    expect(isExpired(done, GAMES, completed + RETENTION_MS + 1)).toBe(true)
  })

  it('an unfinished quest never expires', () => {
    expect(isExpired(play(...station(a, 0)), GAMES, Number.MAX_SAFE_INTEGER)).toBe(false)
  })
})

describe('demo groups', () => {
  it('AE9: hold only group-level event fields, no person', () => {
    expect(DEMO_GROUPS.length).toBeGreaterThanOrEqual(2)
    for (const group of DEMO_GROUPS) {
      expect(Object.keys(group).sort()).toEqual(['name', 'progress'])
      for (const e of group.progress.events) expect(['at', 'code', 'minigameId', 'value']).toEqual(expect.arrayContaining(Object.keys(e)))
    }
  })

  it('differ in their levels, so the example shows the range', () => {
    const levels = DEMO_GROUPS.map((g) => indicators(g.progress.events, GAMES).map((i) => i.level).join())
    expect(new Set(levels).size).toBe(DEMO_GROUPS.length)
  })
})
