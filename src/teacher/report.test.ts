import { describe, expect, it } from 'vitest'
import { burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type Progress, type ProgressAction } from '../minigames/progress'
import { SUGGESTED_NAMES, validateName } from '../group'
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
const level = (progress: Progress, id: string) => indicators(progress, GAMES).find((i) => i.id === id)!.level

describe('indicators (Beispielregel)', () => {
  it('names the three indicators and five ordered levels', () => {
    expect(INDICATORS.map((i) => i.name)).toEqual(['Teamleistung', 'Problemlösung', 'Beteiligung'])
    expect(LEVELS).toEqual(['Einblick gewinnen', 'Kennen', 'Anwenden', 'Beurteilen/Sich positionieren', 'Gestalten'])
    for (const i of INDICATORS) expect(i.descriptions).toHaveLength(5)
    for (const i of indicators(play(), GAMES)) expect(i.rule).toMatch(/^Beispielregel: /)
  })

  it('Teamleistung 5: every station done, none skipped', () => {
    expect(level(play(...station(a, 0), ...station(b, 0), ...station(c, 0)), 'team')).toBe(5)
  })
  it('Teamleistung 4: every station done after a skip', () => {
    expect(level(play({ type: 'skip', id: a, at: 0 }, ...station(a, 0), ...station(b, 0), ...station(c, 0)), 'team')).toBe(4)
  })
  it('Teamleistung 3: at least half of the stations done', () => {
    expect(level(play(...station(a, 0), ...station(b, 0)), 'team')).toBe(3)
  })
  it('Teamleistung 2: one station done', () => {
    expect(level(play(...station(a, 0)), 'team')).toBe(2)
  })
  it('Teamleistung 1: nothing done', () => {
    expect(level(play({ type: 'open', id: a, at: 0 }), 'team')).toBe(1)
  })

  it('Problemlösung 5: solved without hint and at the first attempt', () => {
    expect(level(play(...station(a, 0)), 'problem')).toBe(5)
  })
  it('Problemlösung 4: solved without hint after several attempts', () => {
    expect(level(play(...station(a, 0, { attempts: 2 })), 'problem')).toBe(4)
  })
  it('Problemlösung 3: at most one hint per solved station', () => {
    expect(level(play(...station(a, 0, { hints: 1 })), 'problem')).toBe(3)
  })
  it('Problemlösung 2: solved with more hints', () => {
    expect(level(play(...station(a, 0, { hints: 2 })), 'problem')).toBe(2)
  })
  it('Problemlösung 1: nothing solved', () => {
    expect(level(play({ type: 'open', id: a, at: 0 }, { type: 'hint', id: a, index: 0, at: 0 }), 'problem')).toBe(1)
  })

  const votes = (id: string): ProgressAction[] => [1, 2, 3].map((position) => ({ type: 'vote', id, position, at: 0 }))
  it('Beteiligung 5: all three positions voted and at least 10 minutes active', () => {
    expect(level(play(...votes(c), ...station(a, 0, { minutes: 10 })), 'participation')).toBe(5)
  })
  it('Beteiligung 4: all three positions voted', () => {
    expect(level(play(...votes(c), ...station(a, 0, { minutes: 9 })), 'participation')).toBe(4)
  })
  it('Beteiligung 3: at least 10 minutes active', () => {
    expect(level(play(...station(a, 0, { minutes: 10 })), 'participation')).toBe(3)
  })
  it('Beteiligung 2: a station opened', () => {
    expect(level(play({ type: 'open', id: a, at: 0 }), 'participation')).toBe(2)
  })
  it('Beteiligung 1: nothing opened', () => {
    expect(level(play(), 'participation')).toBe(1)
  })

  it('a station counts as done by its status, not by an E2 event of a station that no longer exists', () => {
    const removed: Progress = { status: {}, events: [{ code: 'E2', minigameId: 'removed', at: 0, value: 'done' }] }
    expect(level(removed, 'team')).toBe(1)
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
    expect(isExpired(0, done, GAMES, completed + RETENTION_MS)).toBe(false)
    expect(isExpired(0, done, GAMES, completed + RETENTION_MS + 1)).toBe(true)
  })

  it('an unfinished quest is kept exactly 12 weeks after its last event', () => {
    const last = 30 * MIN
    const open = play(...station(a, 0), { type: 'open', id: b, at: last })
    expect(isExpired(0, open, GAMES, last + RETENTION_MS)).toBe(false)
    expect(isExpired(0, open, GAMES, last + RETENTION_MS + 1)).toBe(true)
  })

  it('a group without events is kept exactly 12 weeks after its creation', () => {
    const created = 5 * MIN
    expect(isExpired(created, undefined, GAMES, created + RETENTION_MS)).toBe(false)
    expect(isExpired(created, undefined, GAMES, created + RETENTION_MS + 1)).toBe(true)
  })

  // 1 August always falls in summer time, so Europe/Berlin is UTC+2 there.
  const berlin = (local: string) => Date.parse(`${local}+02:00`)

  it('the school year ends on 31 July: data of a group is kept until 23:59:59.999 and deleted from 1 August 00:00', () => {
    const created = berlin('2027-07-01T08:00')
    expect(isExpired(created, undefined, GAMES, berlin('2027-07-31T23:59:59.999'))).toBe(false)
    expect(isExpired(created, undefined, GAMES, berlin('2027-08-01T00:00'))).toBe(true)
  })

  it('a group created on 1 August belongs to the new school year', () => {
    const created = berlin('2027-08-01T00:00')
    expect(isExpired(created, undefined, GAMES, created + 1)).toBe(false)
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

  it('can never share a name with a real group', () => {
    for (const { name } of DEMO_GROUPS) {
      expect(SUGGESTED_NAMES).not.toContain(name)
      expect(validateName(name)).not.toBeNull()
    }
  })

  it('differ in their levels, so the example shows the range', () => {
    const levels = DEMO_GROUPS.map((g) => indicators(g.progress, GAMES).map((i) => i.level).join())
    expect(new Set(levels).size).toBe(DEMO_GROUPS.length)
  })
})

describe('stations marked by the demo help', () => {
  it('AE5: do not count as done for the indicators', () => {
    const progress = reduceProgress(initialProgress(GAMES), { type: 'demo-solve', ids: GAMES.map((g) => g.id), at: 1 })
    expect(indicators(progress, GAMES).map((i) => i.level)).toEqual([1, 1, 1])
  })
})
