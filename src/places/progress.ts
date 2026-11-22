import { load, save } from '../store/db'
import { burgFunkelfels } from '../minigames/burg-funkelfels'
import { initialProgress, placeState, type Progress as GameProgress } from '../minigames/progress'
import { MINIGAME_PLACE, type PlaceId } from './places'

export type Status = 'open' | 'started' | 'done'
type StoredStatus = Exclude<Status, 'open'>
/** Only the reached/finished state per place; positions never get stored. */
export type Progress = Partial<Record<PlaceId, StoredStatus>>

export async function loadProgress(): Promise<Progress> {
  return (await load<Progress>('progress')) ?? {}
}

export async function setStatus(id: PlaceId, status: StoredStatus): Promise<void> {
  const progress = await loadProgress()
  // Reaching a finished place again must not reopen it.
  if (progress[id] === 'done') return
  await save('progress', { ...progress, [id]: status })
}

/**
 * The minigame place follows its minigames; its own stored state only says it was reached.
 * A stored „done“ from before the minigames existed must not show it as finished.
 */
export function withMinigameStatus(places: Progress, games: GameProgress | undefined): Progress {
  const state = placeState(initialProgress(burgFunkelfels, games))
  if (state !== 'new') return { ...places, [MINIGAME_PLACE]: state }
  return places[MINIGAME_PLACE] ? { ...places, [MINIGAME_PLACE]: 'started' } : places
}
