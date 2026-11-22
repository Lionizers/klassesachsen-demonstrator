import { describe, expect, it } from 'vitest'
import { ROLES, type Role } from '../group'
import { FORBIDDEN_BRAND } from '../forbidden-brand'
import { burgFunkelfels } from './burg-funkelfels'
import {
  dilemmaOutcome,
  isEstimateCorrect,
  isPuzzleSolved,
  validateMinigames,
  type Dilemma,
  type Estimate,
  type Minigame,
  type Puzzle,
} from './model'

const text = (s: string) => ({ standard: s, easy: s })
const item = { at: [0, 0] as [number, number], paths: [{ d: 'M0 0h32v32H0Z', fill: '#000' }] }
const base = { title: text('T'), prompt: text('P'), hints: [text('H')], reward: text('R'), item }
const puzzle: Puzzle = { ...base, id: 'p', kind: 'puzzle', pieces: [text('a'), text('b'), text('c')], solution: [2, 0, 1] }
const estimate: Estimate = { ...base, id: 'e', kind: 'estimate', target: 120, unit: 'Kekse', tolerancePercent: 10 }
const dilemma: Dilemma = {
  ...base,
  id: 'd',
  kind: 'dilemma',
  options: [
    { label: text('A'), consequence: text('Folge A') },
    { label: text('B'), consequence: text('Folge B') },
  ],
}

/** All 2^3 ways the three role positions can vote. */
const allVotes = Array.from({ length: 2 ** ROLES.length }, (_, mask) =>
  Object.fromEntries(ROLES.map((role, i) => [role, ((mask >> i) & 1) as 0 | 1])) as Record<Role, 0 | 1>,
)

describe('estimate', () => {
  it('AE2: accepts answers within the tolerance, including exactly on both boundaries', () => {
    for (const answer of [120, 110, 130, 108, 132]) expect(isEstimateCorrect(estimate, answer), String(answer)).toBe(true)
  })

  it('AE3: rejects answers just outside the tolerance', () => {
    for (const answer of [107, 133, 107.9, 132.1]) expect(isEstimateCorrect(estimate, answer), String(answer)).toBe(false)
  })
})

describe('puzzle', () => {
  it('AE1: is solved only in the solution order', () => {
    expect(isPuzzleSolved(puzzle, [2, 0, 1])).toBe(true)
    expect(isPuzzleSolved(puzzle, [0, 1, 2])).toBe(false)
    expect(isPuzzleSolved(puzzle, [2, 0])).toBe(false)
  })
})

describe('dilemma', () => {
  it('AE4: every vote combination yields the majority option', () => {
    for (const votes of allVotes) {
      const ones = Object.values(votes).filter((v) => v === 1).length
      expect(dilemmaOutcome(votes)).toBe(ones >= 2 ? 1 : 0)
    }
  })
})

describe('Burg Funkelfels data', () => {
  it('AE7: every solution of every minigame is accepted', () => {
    expect(burgFunkelfels.map((g) => g.kind).sort()).toEqual(['dilemma', 'estimate', 'puzzle'])
    for (const game of burgFunkelfels) {
      if (game.kind === 'puzzle') {
        expect(isPuzzleSolved(game, game.solution)).toBe(true)
        expect(isPuzzleSolved(game, game.pieces.map((_, i) => i))).toBe(false)
      } else if (game.kind === 'estimate') {
        const delta = (game.target * game.tolerancePercent) / 100
        for (const answer of [game.target, game.target - delta, game.target + delta]) {
          expect(isEstimateCorrect(game, answer)).toBe(true)
        }
        expect(isEstimateCorrect(game, game.target + delta + 1)).toBe(false)
      } else {
        for (const votes of allVotes) expect(game.options[dilemmaOutcome(votes)].consequence.standard).not.toBe('')
      }
    }
  })

  it('AE8: validates without errors', () => {
    expect(validateMinigames(burgFunkelfels)).toEqual([])
  })

  it('does not carry the contracting authority brand', () => {
    expect(JSON.stringify(burgFunkelfels)).not.toMatch(FORBIDDEN_BRAND)
  })
})

describe('validateMinigames', () => {
  const broken: [string, Minigame[]][] = [
    ['duplicate id', [estimate, { ...estimate }]],
    ['empty standard text', [{ ...estimate, title: { standard: ' ', easy: 'T' } }]],
    ['empty easy text', [{ ...estimate, hints: [{ standard: 'H', easy: '' }] }]],
    ['no hint', [{ ...estimate, hints: [] }]],
    ['empty reward', [{ ...estimate, reward: text('') }]],
    ['reward without item art', [{ ...estimate, item: { ...item, paths: [] } }]],
    ['solution repeats a piece', [{ ...puzzle, solution: [0, 0, 1] }]],
    ['solution misses a piece', [{ ...puzzle, solution: [1, 0] }]],
    ['solution out of range', [{ ...puzzle, solution: [3, 0, 1] }]],
    ['puzzle starts solved', [{ ...puzzle, solution: [0, 1, 2] }]],
    ['target zero', [{ ...estimate, target: 0 }]],
    ['tolerance zero', [{ ...estimate, tolerancePercent: 0 }]],
    ['empty consequence', [{ ...dilemma, options: [dilemma.options[0], { label: text('B'), consequence: text('') }] }]],
    ['dilemma judges right or wrong', [{ ...dilemma, options: [dilemma.options[0], { label: text('B'), consequence: text('Das war falsch.') }] }]],
  ]

  it.each(broken)('AE8: rejects %s', (_, games) => {
    expect(validateMinigames(games)).not.toEqual([])
  })

  it('accepts the valid fixtures', () => {
    expect(validateMinigames([puzzle, estimate, dilemma])).toEqual([])
  })
})
