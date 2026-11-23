import type { Minigame } from '../minigames/model'
import { initialProgress, placeState, type GameEvent, type Progress } from '../minigames/progress'
import { collected } from '../collection/items'

export const LEVELS = ['Einblick gewinnen', 'Kennen', 'Anwenden', 'Beurteilen/Sich positionieren', 'Gestalten'] as const
export const RETENTION_WEEKS = 12
export const RETENTION_MS = RETENTION_WEEKS * 7 * 24 * 60 * 60 * 1000

type Facts = { stations: number; done: number; skipped: number; hints: number; retries: number; positions: number; minutes: number; opened: boolean }
/** Checked in order, the first match sets the level; the level 1 rule matches always. */
type Rule = { level: number; when: string; test: (f: Facts) => boolean }

/**
 * Example rules, not a validated assessment: they map group events to levels so the report can be shown.
 * `descriptions` are the competence grid, one per level.
 */
export const INDICATORS: { id: string; name: string; descriptions: string[]; rules: Rule[] }[] = [
  {
    id: 'team',
    name: 'Teamleistung',
    descriptions: [
      'Die Gruppe gewinnt einen ersten Einblick in die Aufgaben und probiert gemeinsam erste Schritte aus.',
      'Die Gruppe kennt den Ablauf einer Station und bringt eine Aufgabe gemeinsam zu Ende.',
      'Die Gruppe wendet ihr Vorgehen auf mehrere Stationen an und schafft mindestens die Hälfte davon.',
      'Die Gruppe beurteilt, wann sie eine Station zurückstellt, und schafft danach alle Stationen.',
      'Die Gruppe gestaltet die Quest als Team und schafft alle Stationen, ohne eine auszulassen.',
    ],
    rules: [
      { level: 5, when: 'alle Stationen geschafft, keine ausgelassen', test: (f) => f.done === f.stations && f.skipped === 0 },
      { level: 4, when: 'alle Stationen geschafft', test: (f) => f.done === f.stations },
      { level: 3, when: 'mindestens die Hälfte der Stationen geschafft', test: (f) => f.done * 2 >= f.stations },
      { level: 2, when: 'mindestens eine Station geschafft', test: (f) => f.done > 0 },
      { level: 1, when: 'noch keine Station geschafft', test: () => true },
    ],
  },
  {
    id: 'problem',
    name: 'Problemlösung',
    descriptions: [
      'Die Gruppe gewinnt einen Einblick in die Aufgaben, löst aber noch keine Station.',
      'Die Gruppe kennt Wege zur Lösung und löst Stationen mit Hilfe mehrerer Hinweise.',
      'Die Gruppe wendet Hinweise gezielt an und braucht höchstens einen Hinweis je gelöster Station.',
      'Die Gruppe beurteilt ihre eigenen Versuche, verbessert sie und löst Stationen ohne Hinweis.',
      'Die Gruppe gestaltet ihren Lösungsweg selbst und löst Stationen ohne Hinweis im ersten Versuch.',
    ],
    rules: [
      { level: 5, when: 'gelöst ohne Hinweis und im ersten Versuch', test: (f) => f.done > 0 && f.hints === 0 && f.retries === 0 },
      { level: 4, when: 'gelöst ohne Hinweis', test: (f) => f.done > 0 && f.hints === 0 },
      { level: 3, when: 'höchstens ein Hinweis je gelöster Station', test: (f) => f.done > 0 && f.hints <= f.done },
      { level: 2, when: 'mindestens eine Station gelöst', test: (f) => f.done > 0 },
      { level: 1, when: 'noch keine Station gelöst', test: () => true },
    ],
  },
  {
    id: 'participation',
    name: 'Beteiligung',
    descriptions: [
      'Die Gruppe gewinnt einen Einblick in die App, hat aber noch keine Station geöffnet.',
      'Die Gruppe kennt die Stationen und hat mindestens eine davon gemeinsam begonnen.',
      'Die Gruppe wendet sich den Aufgaben ausdauernd zu und arbeitet mindestens zehn Minuten aktiv.',
      'Alle drei Positionen der Gruppe beziehen bei einer gemeinsamen Entscheidung Stellung.',
      'Alle drei Positionen beziehen Stellung, und die Gruppe gestaltet mindestens zehn Minuten aktiv mit.',
    ],
    rules: [
      { level: 5, when: 'alle drei Positionen abgestimmt und mindestens zehn Minuten aktiv', test: (f) => f.positions === 3 && f.minutes >= 10 },
      { level: 4, when: 'alle drei Positionen abgestimmt', test: (f) => f.positions === 3 },
      { level: 3, when: 'mindestens zehn Minuten aktiv', test: (f) => f.minutes >= 10 },
      { level: 2, when: 'mindestens eine Station geöffnet', test: (f) => f.opened },
      { level: 1, when: 'noch keine Station geöffnet', test: () => true },
    ],
  },
]

/** E9: active time from the E1 start/end pairs of each station; a start without end does not count. */
export function activeMinutes(events: GameEvent[]): number {
  const started = new Map<string, number>()
  let ms = 0
  for (const e of events) {
    if (e.code !== 'E1') continue
    if (e.value === 'start') started.set(e.minigameId, e.at)
    else if (started.has(e.minigameId)) {
      ms += e.at - started.get(e.minigameId)!
      started.delete(e.minigameId)
    }
  }
  return Math.floor(ms / 60_000)
}

export function indicators(progress: Progress, games: Minigame[]) {
  const { events } = progress
  const of = (code: GameEvent['code'], value?: string) => events.filter((e) => e.code === code && (value === undefined || e.value === value))
  const facts: Facts = {
    stations: games.length,
    done: collected(games, initialProgress(games, progress)).length,
    skipped: of('E2', 'skipped').length,
    hints: of('E5').length,
    retries: of('E3').filter((e) => Number(e.value) > 1).length,
    positions: new Set(of('E7').map((e) => e.value)).size,
    minutes: activeMinutes(events),
    opened: of('E1', 'start').length > 0,
  }
  return INDICATORS.map(({ id, name, descriptions, rules }) => {
    const { level, when } = rules.find((r) => r.test(facts))!
    return { id, name, level, levelName: LEVELS[level - 1], description: descriptions[level - 1], rule: `Beispielregel: ${when}` }
  })
}

/** The time of the event that finished the last open station, once every station is done. */
export function questCompletedAt(progress: Progress, games: Minigame[]): number | undefined {
  const state = initialProgress(games, progress)
  if (placeState(state) !== 'done') return undefined
  const finished = state.events.filter((e) => e.code === 'E2' && e.value === 'done').map((e) => e.at)
  return finished.length ? Math.max(...finished) : undefined
}

/**
 * The first moment of the next school year after `at`. Saxony's school year ends on 31 July; Saxony is in
 * Europe/Berlin, which is always on summer time (UTC+2) on 1 August, so the boundary is a fixed UTC offset.
 */
export function schoolYearEnd(at: number): number {
  const boundary = (year: number) => Date.UTC(year, 7, 1) - 2 * 60 * 60 * 1000
  const year = new Date(at).getUTCFullYear()
  return at < boundary(year) ? boundary(year) : boundary(year + 1)
}

/**
 * Deleted 12 weeks after completion, an unfinished quest 12 weeks after its last activity,
 * and all group data at the end of the school year the group was created in.
 */
export function isExpired(createdAt: number, progress: Progress | undefined, games: Minigame[], now: number): boolean {
  const since = (progress && questCompletedAt(progress, games)) ?? progress?.events.at(-1)?.at ?? createdAt
  return now - since > RETENTION_MS || now >= schoolYearEnd(createdAt)
}
