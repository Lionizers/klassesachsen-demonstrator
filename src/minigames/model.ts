import { ROLES, type Role } from '../group'

/** `easy` is the same text in plain language. */
export type Text = { standard: string; easy: string }

/**
 * Paths are drawn in an ITEM_BOX square; `at` places that square on the character (see collection/ItemArt).
 * Plain path data, so the same art renders as SVG and on a canvas via Path2D.
 */
export type ItemArt = { at: [number, number]; paths: { d: string; fill: string }[] }
export const ITEM_BOX = 32
/** `reward` names the item that `item` draws. */
type Base = { id: string; title: Text; prompt: Text; hints: Text[]; reward: Text; item: ItemArt }
/** Pieces are shown in data order; `solution` lists piece indices in the solved order. */
export type Puzzle = Base & { kind: 'puzzle'; pieces: Text[]; solution: number[] }
/** `solution` shows the way to `target` once the group's estimate counts. */
export type Estimate = Base & { kind: 'estimate'; target: number; unit: string; tolerancePercent: number; solution: Text }
export type DilemmaOption = { label: Text; consequence: Text }
export type Dilemma = Base & { kind: 'dilemma'; options: [DilemmaOption, DilemmaOption] }
export type Minigame = Puzzle | Estimate | Dilemma

/** Makes every switch over `kind` fail to compile when a new kind is added. */
export function unreachable(value: never): never {
  throw new Error(`unknown minigame kind: ${JSON.stringify(value)}`)
}

export function isPuzzleSolved(game: Puzzle, order: number[]): boolean {
  return order.length === game.solution.length && order.every((piece, i) => piece === game.solution[i])
}

// Multiplied out instead of divided, so an integer answer exactly on the boundary is not lost to float rounding.
export function isEstimateCorrect(game: Estimate, answer: number): boolean {
  return Math.abs(answer - game.target) * 100 <= game.target * game.tolerancePercent
}

/** The learning feedback after a counted estimate: the way to the target and how close the group was. */
export function estimateResult(game: Estimate, answer: number): Text {
  const diff = Math.abs(answer - game.target)
  const said = `Eure Schätzung: ${answer.toLocaleString('de-DE')} ${game.unit}, ${diff === 0 ? 'genau getroffen!' : `nur ${diff.toLocaleString('de-DE')} daneben.`}`
  return { standard: `${game.solution.standard} ${said}`, easy: `${game.solution.easy} ${said}` }
}

/** Three positions and two options: there is always a majority. */
export function dilemmaOutcome(votes: Record<Role, 0 | 1>): 0 | 1 {
  return ROLES.filter((role) => votes[role] === 1).length * 2 > ROLES.length ? 1 : 0
}

/** Names the decision and its majority, never who voted how. */
export function voteSummary(game: Dilemma, votes: Record<Role, 0 | 1>): Text {
  const outcome = dilemmaOutcome(votes)
  const count = `${ROLES.filter((role) => votes[role] === outcome).length} von ${ROLES.length} Stimmen`
  const label = game.options[outcome].label
  return { standard: `${count}: ${label.standard}`, easy: `${count}: ${label.easy}` }
}

// A dilemma shows consequences, never a verdict.
const VERDICT = /richtig|falsch/i

function ownTexts(game: Minigame): Text[] {
  switch (game.kind) {
    case 'puzzle':
      return game.pieces
    case 'estimate':
      return [game.solution]
    case 'dilemma':
      return game.options.flatMap((o) => [o.label, o.consequence])
    default:
      return unreachable(game)
  }
}

function texts(game: Minigame): Text[] {
  return [game.title, game.prompt, game.reward, ...game.hints, ...ownTexts(game)]
}

export function validateMinigames(games: Minigame[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const game of games) {
    const at = `${game.id}:`
    if (seen.has(game.id)) errors.push(`${at} duplicate id`)
    seen.add(game.id)
    if (game.hints.length === 0) errors.push(`${at} needs at least one hint`)
    if (game.item.paths.length === 0) errors.push(`${at} reward needs item art`)
    for (const t of texts(game)) {
      if (!t.standard.trim() || !t.easy.trim()) errors.push(`${at} empty text ${JSON.stringify(t)}`)
    }
    switch (game.kind) {
      case 'puzzle': {
        const sorted = [...game.solution].sort((a, b) => a - b)
        if (sorted.length !== game.pieces.length || sorted.some((piece, i) => piece !== i)) {
          errors.push(`${at} solution must be a permutation of the pieces`)
        } else if (game.solution.every((piece, i) => piece === i)) {
          errors.push(`${at} pieces must not start in the solved order`)
        }
        break
      }
      case 'estimate':
        if (!(game.target > 0)) errors.push(`${at} target must be positive`)
        if (!(game.tolerancePercent > 0)) errors.push(`${at} tolerance must be positive`)
        break
      case 'dilemma':
        if (texts(game).some((t) => VERDICT.test(t.standard) || VERDICT.test(t.easy))) {
          errors.push(`${at} dilemma texts must not judge right or wrong`)
        }
        break
      default:
        unreachable(game)
    }
  }
  return errors
}
