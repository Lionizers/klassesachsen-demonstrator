import { useContext, useEffect, useState } from 'preact/hooks'
import { load } from '../store/db'
import { Fidelius } from '../fidelius'
import { DEFAULTS, SettingsContext, text } from '../settings'
import { burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { MINIGAMES_KEY, type Progress } from '../minigames/progress'
import { loadProgress } from '../places/progress'
import { CONTRIBUTIONS_KEY, type Contribution } from '../collage/layout'
import type { ScreenProps } from '../screens/types'
import { CHECKS, CHECKLIST_KEY, experienced, type CheckId, type Jump, type Marks } from './checklist'
import { DemoHelp, restartDemo } from './DemoHelp'

const PURPOSE = {
  standard: 'Hier seht ihr unseren Vorschlag für die Entdecker-App: Schulgruppen erkunden Orte, lösen Minigames und gestalten am Ende ein gemeinsames Bild. Lehrkräfte begleiten die Klasse in einer eigenen Ansicht.',
  easy: 'Das ist unser Vorschlag für die Entdecker-App. Gruppen besuchen Orte, lösen Spiele und malen am Ende ein Bild. Die Lehrkraft hat eine eigene Ansicht.',
}

export function Welcome({ go, group, setGroup, openSettings }: ScreenProps) {
  const settings = useContext(SettingsContext)
  const [done, setDone] = useState<Set<CheckId>>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    Promise.all([load<Marks>(CHECKLIST_KEY), load<Progress>(MINIGAMES_KEY), loadProgress(), load<Contribution[]>(CONTRIBUTIONS_KEY)]).then(
      ([marks, progress, places, contributions]) =>
        setDone(
          experienced({
            marks: marks?.seen ?? [],
            games: GAMES,
            progress,
            placesReached: Object.keys(places).length,
            contributions: contributions ?? [],
            settingsChanged: (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).some((k) => settings[k] !== DEFAULTS[k]),
            hasGroup: !!group,
          }),
        ),
      () => setError('Die Prüfliste konnte nicht geladen werden.'),
    )
  }, [])

  const play = () => go(group ? 'roles' : 'start')
  const jump = (to: Jump) => {
    if (to === 'settings') openSettings()
    else if (to === 'teacher') go('teacher')
    else if (!group) go('start')
    else go(to === 'collection' ? 'collection' : 'map')
  }

  async function restart() {
    if (!confirm('Alle Daten der Demo auf diesem Gerät löschen und von vorn beginnen? Die Einstellungen bleiben.')) return
    try {
      await restartDemo()
    } catch {
      setError('Die Demo konnte nicht neu gestartet werden.')
      return
    }
    setGroup(undefined)
    setDone(new Set())
    go('welcome')
  }

  return (
    <section aria-labelledby="welcome-title">
      <h2 id="welcome-title" tabIndex={-1}>Willkommen beim Demonstrator</h2>
      {error && <p role="alert">{error}</p>}
      <Fidelius>{text(PURPOSE, settings.easy)}</Fidelius>
      <p class="demo">Alle Inhalte sind erfunden. Orte, Figuren und Aufgaben dienen nur der Vorführung.</p>
      <div class="paths">
        <button type="button" class="primary" onClick={play}>Als Schulgruppe spielen (ca. 5 Minuten)</button>
        <button type="button" class="primary" onClick={() => go('teacher')}>Als Lehrkraft ansehen</button>
      </div>
      <h3>Prüfliste: So erfüllt die Demo die Ausschreibung</h3>
      <ul aria-label="Prüfliste" class="checklist">
        {CHECKS.map((check) => {
          const seen = done?.has(check.id) ?? false
          return (
            <li key={check.id} class={seen ? 'seen' : undefined}>
              <span class="pill">{seen ? 'erlebt' : 'noch offen'}</span>
              <strong>{check.title}</strong> <span class="lv">{check.lv}</span>
              <p>{check.how}</p>
              <button type="button" aria-label={`Ansehen: ${check.title}`} onClick={() => jump(check.jump)}>Ansehen</button>
            </li>
          )
        })}
      </ul>
      <DemoHelp>
        <button type="button" onClick={restart}>Demo neu starten</button>
      </DemoHelp>
    </section>
  )
}
