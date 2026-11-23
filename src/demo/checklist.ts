import type { Minigame } from '../minigames/model'
import type { Progress } from '../minigames/progress'
import type { Contribution } from '../collage/layout'
import { load, save } from '../store/db'

/** What the stored game state cannot tell: that the app ran offline, that the teacher view was opened. */
export const CHECKLIST_KEY = 'checklist'
export type Mark = 'offline' | 'teacher'
export type Marks = { seen: Mark[] }

let pending: Promise<void> = Promise.resolve()

/**
 * Notes a mark once; rejects when it could not be stored, so the caller can say so.
 * Marks run one after another: two overlapping read-and-write rounds would drop one of them.
 */
export function markSeen(mark: Mark): Promise<void> {
  const run = pending.catch(() => {}).then(async () => {
    const seen = (await load<Marks>(CHECKLIST_KEY))?.seen ?? []
    if (!seen.includes(mark)) await save(CHECKLIST_KEY, { seen: [...seen, mark] } satisfies Marks)
  })
  pending = run
  return run
}

export type CheckId = 'offline' | 'order' | 'minigames' | 'contribution' | 'accessibility' | 'privacy' | 'dashboard' | 'interface'
/** Where the jump of a check leads; the app resolves it against the current group. */
export type Jump = 'play' | 'collection' | 'settings' | 'teacher'

/** The tender requirements the demonstrator shows, in the order an evaluator meets them. */
export const CHECKS: { id: CheckId; title: string; lv: string; how: string; jump: Jump }[] = [
  { id: 'offline', title: 'Offline spielbar', lv: 'LV 3.1 a', jump: 'play', how: 'Einmal geladen, läuft die App ohne Netz. Schaltet das WLAN aus und spielt weiter; die Ergebnisse warten, bis wieder Netz da ist.' },
  { id: 'order', title: 'Freie Reihenfolge', lv: 'LV 4.2', jump: 'play', how: 'Kein Ort und keine Station ist gesperrt. Beginnt mit einer beliebigen Station oder stellt eine zurück.' },
  { id: 'minigames', title: 'Minigames', lv: 'LV 4.2', jump: 'play', how: 'Drei Minigames bei Burg Funkelfels: Reihenfolge-Puzzle, Schätzaufgabe und gemeinsame Entscheidung.' },
  { id: 'contribution', title: 'Bildbeitrag', lv: 'LV 4.4', jump: 'collection', how: 'Aus den gesammelten Items gestaltet die Gruppe eine Collage und speichert sie als Beitrag.' },
  { id: 'accessibility', title: 'Barrierefreiheit', lv: 'LV 4.5', jump: 'settings', how: 'Vorlesen, einfache Sprache, hoher Kontrast, Ton und Spieltempo; alles mit der Tastatur bedienbar.' },
  { id: 'privacy', title: 'Datenschutz ohne Konten', lv: 'Anlage 2', jump: 'play', how: 'Gruppen statt Kinder, kein Konto, Daten nur auf dem Gerät und Löschung durch die Lehrkraft.' },
  { id: 'dashboard', title: 'Dashboard für Lehrkräfte', lv: 'LV 4.3', jump: 'teacher', how: 'Stand der Gruppen, Kompetenzraster und Bericht, ohne Rangliste und ohne Noten.' },
  { id: 'interface', title: 'Schnittstelle für Bildbeiträge', lv: 'LV 4.4 / 4.8', jump: 'teacher', how: 'Gibt die Lehrkraft eine Collage frei, liefert die Schnittstelle /api/beitraege sie aus.' },
]

/** A station opened while one listed before it was still open: the group chose its own order. */
export function choseOwnOrder(games: Minigame[], progress: Progress | undefined): boolean {
  const done = new Set<string>()
  for (const e of progress?.events ?? []) {
    if (e.code === 'E2' && e.value === 'done') done.add(e.minigameId)
    if (e.code === 'D1') done.add(e.minigameId)
    if (e.code === 'E1' && e.value === 'start') {
      const index = games.findIndex((g) => g.id === e.minigameId)
      if (games.slice(0, index).some((g) => !done.has(g.id))) return true
    }
    if (e.code === 'E2' && e.value === 'skipped') return true
  }
  return false
}

export type Facts = {
  marks: Mark[]
  games: Minigame[]
  progress: Progress | undefined
  placesReached: number
  contributions: Contribution[]
  settingsChanged: boolean
  hasGroup: boolean
}

/** Derived from what is stored anyway, so a reload shows the same ticks without a list of its own. */
export function experienced(f: Facts): Set<CheckId> {
  const events = f.progress?.events ?? []
  // A record, so a check without a rule fails to compile instead of never ticking.
  const checks: Record<CheckId, boolean> = {
    offline: f.marks.includes('offline'),
    order: f.placesReached >= 2 || choseOwnOrder(f.games, f.progress),
    // Only a played station counts; one marked as solved by the demo help has no E2.
    minigames: events.some((e) => e.code === 'E2' && e.value === 'done'),
    contribution: f.contributions.length > 0,
    accessibility: f.settingsChanged,
    privacy: f.hasGroup,
    dashboard: f.marks.includes('teacher'),
    interface: f.contributions.some((c) => c.released),
  }
  return new Set((Object.keys(checks) as CheckId[]).filter((id) => checks[id]))
}
