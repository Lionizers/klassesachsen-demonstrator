import { burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { initialProgress, reduceProgress, type Progress, type ProgressAction } from '../minigames/progress'

const [puzzle, estimate, dilemma] = GAMES.map((g) => g.id)
const START = Date.UTC(2026, 10, 16, 8)
const at = (minutes: number) => START + minutes * 60_000
const play = (...actions: ProgressAction[]): Progress => actions.reduce(reduceProgress, initialProgress(GAMES))
const votes = (positions: number[], minutes: number): ProgressAction[] =>
  positions.map((position) => ({ type: 'vote', id: dilemma, position, at: at(minutes) }))

/** Invented groups, so the views show something without a class; never stored, always labelled as invented. */
export const DEMO_GROUPS: { name: string; progress: Progress }[] = [
  {
    name: 'Ahorn',
    progress: play(
      { type: 'open', id: puzzle, at: at(0) },
      { type: 'hint', id: puzzle, index: 0, at: at(3) },
      { type: 'attempt', id: puzzle, correct: false, at: at(6) },
      { type: 'attempt', id: puzzle, correct: true, at: at(8) },
      { type: 'open', id: estimate, at: at(10) },
      { type: 'attempt', id: estimate, correct: true, at: at(14) },
      { type: 'open', id: dilemma, at: at(16) },
      ...votes([1, 2, 3], 20),
      { type: 'decide', id: dilemma, option: 1, at: at(21) },
    ),
  },
  {
    name: 'Birke',
    progress: play(
      { type: 'open', id: puzzle, at: at(0) },
      { type: 'skip', id: puzzle, at: at(5) },
      { type: 'open', id: estimate, at: at(6) },
      { type: 'hint', id: estimate, index: 0, at: at(8) },
      { type: 'hint', id: estimate, index: 1, at: at(9) },
      { type: 'attempt', id: estimate, correct: false, at: at(10) },
      { type: 'attempt', id: estimate, correct: true, at: at(12) },
      { type: 'open', id: dilemma, at: at(13) },
      ...votes([1, 2], 16),
      { type: 'decide', id: dilemma, option: 0, at: at(17) },
    ),
  },
  {
    name: 'Eiche',
    progress: play({ type: 'open', id: puzzle, at: at(0) }, { type: 'hint', id: puzzle, index: 0, at: at(2) }),
  },
]
