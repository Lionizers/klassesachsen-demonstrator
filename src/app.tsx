import { useEffect, useState } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import type { Group } from './group'
import { load } from './store/db'
import { GroupStart } from './screens/GroupStart'
import { GroupRoles } from './screens/GroupRoles'
import type { Screen, ScreenProps } from './screens/types'

const screens: Record<Screen, FunctionComponent<ScreenProps>> = {
  start: GroupStart,
  roles: GroupRoles,
}

export function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    load<Group>('group').then(
      (group) => setScreen(group ? 'roles' : 'start'),
      () => setError('Der Speicher dieses Geräts ist nicht verfügbar.'),
    )
  }, [])

  const Current = screen ? screens[screen] : null
  return (
    <>
      <header class="site-header">
        <h1>Demonstrator der Lionizers GmbH</h1>
        <p>Ortsbasierte Lern- und Entdecker-App für Schulklassen · Web-App, installierbar und offline nutzbar</p>
      </header>
      <main>
        {error && <p role="alert">{error}</p>}
        {Current && <Current go={setScreen} />}
        <p class="note">Alle Inhalte sind erfundene Beispiele. Orte, Figuren und Aufgaben dienen nur der Vorführung.</p>
      </main>
    </>
  )
}
