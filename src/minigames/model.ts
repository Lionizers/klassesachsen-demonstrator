import { ROLES, type Role } from '../group'

/** `easy` is the same text in plain language. */
export type Text = { standard: string; easy: string }

type Base = { id: string; title: Text; prompt: Text; hints: Text[]; reward: Text }
/** Pieces are shown in data order; `solution` lists piece indices in the solved order. */
export type Puzzle = Base & { kind: 'puzzle'; pieces: Text[]; solution: number[] }
export type Estimate = Base & { kind: 'estimate'; target: number; unit: string; tolerancePercent: number }
export type DilemmaOption = { label: Text; consequence: Text }
export type Dilemma = Base & { kind: 'dilemma'; options: [DilemmaOption, DilemmaOption] }
export type Minigame = Puzzle | Estimate | Dilemma

export function isPuzzleSolved(game: Puzzle, order: number[]): boolean {
  return order.length === game.solution.length && order.every((piece, i) => piece === game.solution[i])
}

// Multiplied out instead of divided, so an integer answer exactly on the boundary is not lost to float rounding.
export function isEstimateCorrect(game: Estimate, answer: number): boolean {
  return Math.abs(answer - game.target) * 100 <= game.target * game.tolerancePercent
}

/** Three positions and two options: there is always a majority. */
export function dilemmaOutcome(votes: Record<Role, 0 | 1>): 0 | 1 {
  return ROLES.filter((role) => votes[role] === 1).length * 2 > ROLES.length ? 1 : 0
}

// A dilemma shows consequences, never a verdict.
const VERDICT = /richtig|falsch/i

function texts(game: Minigame): Text[] {
  const own =
    game.kind === 'puzzle' ? game.pieces : game.kind === 'dilemma' ? game.options.flatMap((o) => [o.label, o.consequence]) : []
  return [game.title, game.prompt, game.reward, ...game.hints, ...own]
}

export function validateMinigames(games: Minigame[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const game of games) {
    const at = `${game.id}:`
    if (seen.has(game.id)) errors.push(`${at} duplicate id`)
    seen.add(game.id)
    if (game.hints.length === 0) errors.push(`${at} needs at least one hint`)
    for (const t of texts(game)) {
      if (!t.standard.trim() || !t.easy.trim()) errors.push(`${at} empty text ${JSON.stringify(t)}`)
    }
    if (game.kind === 'puzzle') {
      const sorted = [...game.solution].sort((a, b) => a - b)
      if (sorted.length !== game.pieces.length || sorted.some((piece, i) => piece !== i)) {
        errors.push(`${at} solution must be a permutation of the pieces`)
      } else if (game.solution.every((piece, i) => piece === i)) {
        errors.push(`${at} pieces must not start in the solved order`)
      }
    } else if (game.kind === 'estimate') {
      if (!(game.target > 0)) errors.push(`${at} target must be positive`)
      if (!(game.tolerancePercent > 0)) errors.push(`${at} tolerance must be positive`)
    } else if (texts(game).some((t) => VERDICT.test(t.standard) || VERDICT.test(t.easy))) {
      errors.push(`${at} dilemma texts must not judge right or wrong`)
    }
  }
  return errors
}
