import { useEffect, useState } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { GROUP_KEY, type Group } from './group'
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
  const [group, setGroup] = useState<Group>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    load<Group>(GROUP_KEY).then(
      (stored) => {
        setGroup(stored)
        setScreen(stored ? 'roles' : 'start')
      },
      () => setError('Der Speicher dieses Geräts ist nicht verfügbar.'),
    )
  }, [])

  function go(next: Screen) {
    setScreen(next)
    // Keyboard and screen reader users would otherwise lose focus with the removed button.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main h2')?.focus())
  }

  const Current = screen ? screens[screen] : null
  return (
    <>
      <header class="site-header">
        <h1>Demonstrator der Lionizers GmbH</h1>
        <p>Ortsbasierte Lern- und Entdecker-App für Schulklassen · Web-App, installierbar und offline nutzbar</p>
      </header>
      <main>
        {error && <p role="alert">{error}</p>}
        {Current && <Current go={go} group={group} setGroup={setGroup} />}
        <p class="note">Alle Inhalte sind erfundene Beispiele. Orte, Figuren und Aufgaben dienen nur der Vorführung.</p>
      </main>
    </>
  )
}
