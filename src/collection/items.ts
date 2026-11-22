import type { Minigame } from '../minigames/model'
import type { Progress } from '../minigames/progress'

export const CHARACTER_KEY = 'character'
export type Character = { worn: string[] }

/** Derived from the station status, never stored: a station is done once, so its item exists once. */
export function collected(games: Minigame[], progress: Progress): Minigame[] {
  return games.filter((g) => progress.status[g.id] === 'done')
}

/** Only collected items can be worn; ids of removed stations are dropped. */
export function wornOf(stored: Character | undefined, items: Minigame[]): string[] {
  return (stored?.worn ?? []).filter((id) => items.some((item) => item.id === id))
}
