import type { Minigame } from './model'

export const MINIGAMES_KEY = 'minigames'

export type StationStatus = 'open' | 'skipped' | 'done'

/**
 * Group-level events only: no role, no person, no individual vote.
 * `value` per code: E1 'start' | 'end', E2 'done' | 'skipped', E3 attempt number,
 * E4 chosen option index, E5 hint number, E7 role position (1-3) of one input, E8 none.
 * E6 and E9 are not stored: no minigame shows a change of approach, and active time follows from the E1 pair.
 */
export type GameEvent = {
  code: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E7' | 'E8'
  minigameId: string
  at: number
  value?: string | number
}

export type Progress = { status: Record<string, StationStatus>; events: GameEvent[] }

export type ProgressAction =
  | { type: 'open'; id: string; at: number }
  | { type: 'hint'; id: string; index: number; at: number }
  | { type: 'attempt'; id: string; correct: boolean; at: number }
  | { type: 'vote'; id: string; position: number; at: number }
  | { type: 'decide'; id: string; option: 0 | 1; at: number }
  | { type: 'skip'; id: string; at: number }

export function initialProgress(games: Minigame[]): Progress {
  return { status: Object.fromEntries(games.map((g) => [g.id, 'open'])), events: [] }
}

export function reduceProgress(state: Progress, action: ProgressAction): Progress {
  const { id: minigameId, at } = action
  const event = (code: GameEvent['code'], value?: string | number): GameEvent =>
    value === undefined ? { code, minigameId, at } : { code, minigameId, at, value }
  const finish = (status: StationStatus, ...events: GameEvent[]): Progress => ({
    status: { ...state.status, [minigameId]: status },
    events: [...state.events, ...events, event('E2', status), event('E1', 'end')],
  })
  const add = (...events: GameEvent[]): Progress => ({ ...state, events: [...state.events, ...events] })

  switch (action.type) {
    case 'open':
      return add(event('E1', 'start'))
    case 'hint':
      return add(event('E5', action.index + 1))
    case 'attempt': {
      const attempt = event('E3', state.events.filter((e) => e.code === 'E3' && e.minigameId === minigameId).length + 1)
      return action.correct ? finish('done', attempt) : add(attempt)
    }
    case 'vote':
      return add(event('E7', action.position))
    case 'decide':
      return finish('done', event('E8'), event('E4', action.option))
    case 'skip':
      return finish('skipped')
  }
}

export function placeState(progress: Progress): 'new' | 'started' | 'done' {
  if (Object.values(progress.status).every((s) => s === 'done')) return 'done'
  return progress.events.length > 0 ? 'started' : 'new'
}
