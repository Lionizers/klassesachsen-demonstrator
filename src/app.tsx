import { useEffect, useState } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { GROUP_KEY, type Group } from './group'
import { load, save } from './store/db'
import { focusHeading } from './focus'
import { OfflineBadge, TechPanel, useOffline } from './offline'
import { FoxArt } from './fidelius'
import { DEFAULTS, ReadAloud, SETTINGS_KEY, SettingsContext, SettingsPanel, type Settings } from './settings'
import { GroupStart } from './screens/GroupStart'
import { GroupRoles } from './screens/GroupRoles'
import { PlaceMap } from './screens/PlaceMap'
import { Collection } from './screens/Collection'
import { Teacher, purgeExpired } from './screens/Teacher'
import { SCREEN_KEY, type Screen, type ScreenProps } from './screens/types'

const screens: Record<Screen, FunctionComponent<ScreenProps>> = {
  start: GroupStart,
  roles: GroupRoles,
  map: PlaceMap,
  collection: Collection,
  teacher: Teacher,
}

export function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [group, setGroup] = useState<Group>()
  const [error, setError] = useState<string>()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [purgeError, setPurgeError] = useState(false)
  const [startCode, setStartCode] = useState<string>()
  const offline = useOffline()

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('start')
    // Dropped from the address in any case, so a reload or a later start screen cannot start the group again.
    if (code !== null) history.replaceState(null, '', location.pathname)
    // A failed retention check must not lock the group out of its game; it is reported instead.
    purgeExpired(Date.now())
      .catch(() => setPurgeError(true))
      .then(() => Promise.all([load<Group>(GROUP_KEY), load<string>(SCREEN_KEY), load<Settings>(SETTINGS_KEY)]))
      .then(
        ([stored, last, storedSettings]) => {
          setSettings({ ...DEFAULTS, ...storedSettings })
          setGroup(stored)
          if (code !== null && stored) setError(`Auf diesem Gerät spielt schon die Gruppe ${stored.name}. Der Startcode ${code} wurde nicht verwendet.`)
          else if (code !== null) setStartCode(code)
          // The stored name may be from a version with other screens.
          setScreen(!stored ? 'start' : last && Object.hasOwn(screens, last) ? (last as Screen) : 'roles')
        },
        () => setError('Der Speicher dieses Geräts ist nicht verfügbar.'),
      )
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = settings.contrast ? 'high' : 'normal'
    root.dataset.tempo = settings.tempo
  }, [settings])

  function go(next: Screen) {
    setStartCode(undefined)
    setScreen(next)
    focusHeading()
    save(SCREEN_KEY, next).catch(() => setError('Die aktuelle Ansicht konnte nicht gespeichert werden.'))
  }

  const Current = screen ? screens[screen] : null
  return (
    <SettingsContext.Provider value={settings}>
      <header class="site-header">
        <div class="brand">
          <FoxArt class="logo" />
          <h1>Entdeckerreise <span>Demonstrator der Lionizers GmbH</span></h1>
        </div>
        <OfflineBadge kb={offline.kb} />
        <nav aria-label="Menü" class="menu">
          <ReadAloud />
          <SettingsPanel settings={settings} onChange={setSettings} />
          <button type="button" onClick={() => go('teacher')}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 3 1 8l11 5 9-4.1V15h2V8Z M5 12.2V16c0 2 3.1 4 7 4s7-2 7-4v-3.8l-7 3.2Z" fill="currentColor" />
            </svg>
            <span class="label">Lehrkräfte-Ansicht</span>
          </button>
        </nav>
        {purgeError && <p role="alert">Abgelaufene Gruppendaten konnten nicht gelöscht werden.</p>}
      </header>
      <main>
        {error && <p role="alert">{error}</p>}
        {Current && <Current go={go} group={group} setGroup={setGroup} startCode={startCode} />}
        <p class="note">Alle Inhalte sind erfundene Beispiele. Orte, Figuren und Aufgaben dienen nur der Vorführung.</p>
      </main>
      <footer class="site-footer">
        <TechPanel {...offline} />
      </footer>
    </SettingsContext.Provider>
  )
}
