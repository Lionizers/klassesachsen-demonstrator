import { useState } from 'preact/hooks'
import { GROUP_KEY, rolesFor } from '../group'
import { save } from '../store/db'
import type { ScreenProps } from './types'

export function GroupRoles({ go, group, setGroup }: ScreenProps) {
  const [error, setError] = useState<string>()
  if (!group) return null

  async function nextRound() {
    const next = { ...group!, round: group!.round + 1 }
    try {
      await save(GROUP_KEY, next)
    } catch {
      setError('Die neue Runde konnte nicht gespeichert werden.')
      return
    }
    setGroup(next)
  }

  return (
    <section aria-labelledby="group-title">
      <h2 id="group-title" tabIndex={-1}>Gruppe {group.name}</h2>
      {error && <p role="alert">{error}</p>}
      <p aria-live="polite">Runde {group.round + 1}. Ihr spielt gemeinsam an einem Gerät. Die Rollen wechseln jede Runde.</p>
      <ol aria-label="Rollen in dieser Runde">
        {rolesFor(group.round).map((role, i) => (
          <li key={role}>Position {i + 1}: {role}</li>
        ))}
      </ol>
      <button type="button" onClick={nextRound}>Neue Runde</button>{' '}
      <button type="button" onClick={() => go('map')}>Zur Karte</button>
    </section>
  )
}
