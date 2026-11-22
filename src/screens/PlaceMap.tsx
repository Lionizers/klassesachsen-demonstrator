import { useEffect, useState } from 'preact/hooks'
import { PLACES, type Place } from '../places/places'
import { loadProgress, type Progress, type Status } from '../places/progress'
import { PlaceView } from './PlaceView'
import type { ScreenProps } from './types'

const STATUS_LABEL: Record<Status, string> = { open: 'offen', started: 'angefangen', done: 'fertig' }

// Own, clearly invented artwork in the 400x300 space that the places' x/y percentages refer to.
function MapArt() {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Fantasiekarte der Spielregion mit Burg, Kloster und Mühle">
      <rect width="400" height="300" fill="#e4ecc9" />
      <path d="M250 0 C230 80 330 120 300 190 S330 270 310 300" fill="none" stroke="#7fb3d5" stroke-width="16" />
      <path d="M88 66 C150 90 220 110 280 120 M88 66 C100 140 110 190 120 234 M120 234 C190 220 250 170 280 120"
        fill="none" stroke="#a68a64" stroke-width="4" stroke-dasharray="8 6" />
      {[[30, 150], [50, 170], [175, 40], [195, 60], [350, 40], [370, 250], [200, 280]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="14" fill="#6a994e" />
      ))}
      <path d="M140 300 L175 250 L210 300 Z M330 140 L360 95 L390 140 Z" fill="#b5a98a" />
      <g fill="#6d6875">
        <rect x="72" y="36" width="32" height="30" />
        <path d="M72 36 v-8 h6 v8 h7 v-8 h6 v8 h7 v-8 h6 v8 z" />
      </g>
      <g>
        <rect x="266" y="96" width="28" height="24" fill="#e5989b" />
        <path d="M262 98 L280 80 L298 98 Z" fill="#9d0208" />
      </g>
      <g stroke="#6d4c41" stroke-width="4">
        <rect x="110" y="212" width="20" height="22" fill="#d4a373" stroke="none" />
        <path d="M120 212 l-16 -16 M120 212 l16 -16 M120 212 l-16 16 M120 212 l16 16" />
      </g>
    </svg>
  )
}

export function PlaceMap({ go }: ScreenProps) {
  const [progress, setProgress] = useState<Progress>()
  const [selected, setSelected] = useState<Place>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!selected) loadProgress().then(setProgress, () => setError('Der Spielstand konnte nicht geladen werden.'))
  }, [selected])

  function back() {
    // Drop the old state so the map never shows a stale status while reloading.
    setProgress(undefined)
    setSelected(undefined)
  }

  if (selected) return <PlaceView place={selected} onBack={back} />
  if (error) return <p role="alert">{error}</p>
  if (!progress) return null
  return (
    <section aria-labelledby="map-title">
      <h2 id="map-title" tabIndex={-1}>Karte der Spielregion</h2>
      <p>Wählt einen Ort. Die Reihenfolge ist frei.</p>
      <div class="map">
        <MapArt />
        <ul aria-label="Orte" class="map-places">
          {PLACES.map((p) => (
            <li key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <button type="button" onClick={() => setSelected(p)}>
                {p.name} – {STATUS_LABEL[progress[p.id] ?? 'open']}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={() => go('roles')}>Zurück zur Gruppe</button>
    </section>
  )
}
