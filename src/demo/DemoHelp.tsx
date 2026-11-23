import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { useQrCodes } from '../qr-codes'
import { PLACES, type Place } from '../places/places'
import { removeAllExcept } from '../store/db'
import { SETTINGS_KEY } from '../settings'
import type { ProgressAction } from '../minigames/progress'

/**
 * Shortcuts for the evaluators. They live in this module only, so a real app leaves them out with it,
 * and each one is framed and labelled as a demo aid.
 */
export function DemoHelp({ children }: { children: ComponentChildren }) {
  return (
    <aside class="demo-help" aria-label="Demo-Hilfe">
      <p class="demo-label">Demo-Hilfe · nur für die Vorführung, fehlt in der echten App</p>
      {children}
    </aside>
  )
}

/** Marks every open station as solved; `apply` stores it and resolves true, then the group goes to the collage. */
export function DemoSolveHelp({ ids, apply, onSolved }: { ids: string[]; apply: (action: ProgressAction) => Promise<boolean>; onSolved: () => void }) {
  return (
    <DemoHelp>
      <button
        type="button"
        // Only once stored, or the collection would load the stations still open.
        onClick={() => apply({ type: 'demo-solve', ids, at: Date.now() }).then((stored) => stored && onSolved())}
      >
        Restliche Stationen als gelöst markieren
      </button>
    </DemoHelp>
  )
}

/** Everything but the settings: the demo starts over as on a fresh device. */
export const restartDemo = () => removeAllExcept([SETTINGS_KEY])

/** The code of the place and the way to a printable sheet with the QR codes of every place. */
export function PlaceCodeHelp({ place, onSheet }: { place: Place; onSheet: () => void }) {
  return (
    <DemoHelp>
      <p>Demo-Code dieses Orts: <strong>{place.code}</strong></p>
      <button type="button" onClick={onSheet}>QR-Blatt der Orte zeigen</button>
    </DemoHelp>
  )
}

/** One QR sign per place, as a group would scan it on site. */
export function QrSheet({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string>()
  const qr = useQrCodes(PLACES.map((p) => p.code), () => setError('Die QR-Codes konnten nicht erzeugt werden.'))
  return (
    <section aria-labelledby="qr-title">
      <h2 id="qr-title" tabIndex={-1}>QR-Blatt der Orte</h2>
      {error && <p role="alert">{error}</p>}
      <p class="demo-label">Demo-Hilfe · Ausdrucken und an den Orten aufhängen, oder vom Bildschirm scannen.</p>
      <ul aria-label="QR-Schilder" class="codes">
        {PLACES.map((p, i) => (
          <li key={p.id}>
            <h3>{p.name}</h3>
            <p>Code: <strong>{p.code}</strong></p>
            {qr[i] && <img src={qr[i]} width={192} height={192} alt={`QR-Code für ${p.name}`} />}
          </li>
        ))}
      </ul>
      <div class="actions">
        <button type="button" onClick={onBack}>Zurück zum Ort</button>
        <button type="button" class="end" onClick={() => print()}>Drucken</button>
      </div>
    </section>
  )
}
