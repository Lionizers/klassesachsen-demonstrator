import { useEffect, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { PLACES, type Place, type PlaceId } from '../places/places'
import { loadProgress, type Progress, type Status } from '../places/progress'
import { PlaceView } from './PlaceView'
import { focusHeading } from '../focus'
import type { ScreenProps } from './types'

const STATUS_LABEL: Record<Status, string> = { open: 'offen', started: 'angefangen', done: 'fertig' }

const W = 400
const H = 300
/** Map point of a place in viewBox units; it marks the bottom middle of its building, where the label starts. */
const at = (p: Place) => [(p.x * W) / 100, (p.y * H) / 100]

// Drawn around (0,0) = bottom middle; the scenery around them is fixed decoration.
const BUILDINGS: Record<PlaceId, JSX.Element> = {
  funkelfels: (
    <g fill="#6d6875">
      <rect x="-16" y="-30" width="32" height="30" />
      <path d="M-16 -30 v-8 h6 v8 h7 v-8 h6 v8 h7 v-8 h6 v8 z" />
    </g>
  ),
  kruemelbach: (
    <g>
      <rect x="-14" y="-24" width="28" height="24" fill="#e5989b" />
      <path d="M-18 -22 L0 -40 L18 -22 Z" fill="#9d0208" />
    </g>
  ),
  wackelstein: (
    <g stroke="#6d4c41" stroke-width="4">
      <rect x="-10" y="-22" width="20" height="22" fill="#d4a373" stroke="none" />
      <path d="M0 -22 l-16 -16 M0 -22 l16 -16 M0 -22 l-16 16 M0 -22 l16 16" />
    </g>
  ),
}

// Own, clearly invented artwork; the places' x/y percentages refer to its viewBox.
function MapArt() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fantasiekarte der Spielregion mit Burg, Kloster und Mühle">
      <rect width={W} height={H} fill="#e4ecc9" />
      <path d="M250 0 C230 80 330 120 300 190 S330 270 310 300" fill="none" stroke="#7fb3d5" stroke-width="16" />
      <path d={`M${PLACES.map((p) => at(p).join(' ')).join(' L')} Z`}
        fill="none" stroke="#a68a64" stroke-width="4" stroke-dasharray="8 6" />
      {[[30, 150], [50, 170], [175, 40], [195, 60], [350, 40], [370, 250], [200, 280]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="14" fill="#6a994e" />
      ))}
      <path d="M140 300 L175 250 L210 300 Z M330 140 L360 95 L390 140 Z" fill="#b5a98a" />
      {PLACES.map((p) => (
        <g key={p.id} transform={`translate(${at(p).join(' ')})`}>{BUILDINGS[p.id]}</g>
      ))}
    </svg>
  )
}

export function PlaceMap({ go }: ScreenProps) {
  // Empty until loaded: every place reads as open, so the heading is there for focus right away.
  const [progress, setProgress] = useState<Progress>({})
  const [selected, setSelected] = useState<Place>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (selected) return
    loadProgress().then(
      (loaded) => {
        setProgress(loaded)
        setError(undefined)
      },
      () => setError('Der Spielstand konnte nicht geladen werden.'),
    )
  }, [selected])

  function show(place: Place | undefined) {
    setSelected(place)
    focusHeading()
  }

  if (selected) return <PlaceView place={selected} onBack={() => show(undefined)} />
  return (
    <section aria-labelledby="map-title">
      <h2 id="map-title" tabIndex={-1}>Karte der Spielregion</h2>
      {error && <p role="alert">{error}</p>}
      <p>Wählt einen Ort. Die Reihenfolge ist frei.</p>
      <div class="map">
        <MapArt />
        <ul aria-label="Orte" class="map-places">
          {PLACES.map((p) => (
            <li key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <button type="button" onClick={() => show(p)}>
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
