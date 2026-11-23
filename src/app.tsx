import { useEffect, useState } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { GROUP_KEY, type Group } from './group'
import { load, save } from './store/db'
import { focusHeading } from './focus'
import { OfflineStatus } from './offline'
import { GroupStart } from './screens/GroupStart'
import { GroupRoles } from './screens/GroupRoles'
import { PlaceMap } from './screens/PlaceMap'
import { Collection } from './screens/Collection'
import { SCREEN_KEY, type Screen, type ScreenProps } from './screens/types'

const screens: Record<Screen, FunctionComponent<ScreenProps>> = {
  start: GroupStart,
  roles: GroupRoles,
  map: PlaceMap,
  collection: Collection,
}

export function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [group, setGroup] = useState<Group>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    Promise.all([load<Group>(GROUP_KEY), load<string>(SCREEN_KEY)]).then(
      ([stored, last]) => {
        setGroup(stored)
        // The stored name may be from a version with other screens.
        setScreen(!stored ? 'start' : last && Object.hasOwn(screens, last) ? (last as Screen) : 'roles')
      },
      () => setError('Der Speicher dieses Geräts ist nicht verfügbar.'),
    )
  }, [])

  function go(next: Screen) {
    setScreen(next)
    focusHeading()
    save(SCREEN_KEY, next).catch(() => setError('Die aktuelle Ansicht konnte nicht gespeichert werden.'))
  }

  const Current = screen ? screens[screen] : null
  return (
    <>
      <header class="site-header">
        <h1>Demonstrator der Lionizers GmbH</h1>
        <p>Ortsbasierte Lern- und Entdecker-App für Schulklassen · Web-App, installierbar und offline nutzbar</p>
        <OfflineStatus />
      </header>
      <main>
        {error && <p role="alert">{error}</p>}
        {Current && <Current go={go} group={group} setGroup={setGroup} />}
        <p class="note">Alle Inhalte sind erfundene Beispiele. Orte, Figuren und Aufgaben dienen nur der Vorführung.</p>
      </main>
    </>
  )
}
