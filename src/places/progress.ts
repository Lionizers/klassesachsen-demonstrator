import { load, save } from '../store/db'
import type { PlaceId } from './places'

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
