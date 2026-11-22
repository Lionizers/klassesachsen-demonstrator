import { useEffect, useState } from 'preact/hooks'
import { rolesFor, type Group } from '../group'
import { load, save } from '../store/db'

export function GroupRoles() {
  const [group, setGroup] = useState<Group>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    load<Group>('group').then(setGroup, () => setError('Die Gruppe konnte nicht geladen werden.'))
  }, [])

  async function nextRound() {
    if (!group) return
    const next = { ...group, round: group.round + 1 }
    try {
      await save('group', next)
    } catch {
      setError('Die neue Runde konnte nicht gespeichert werden.')
      return
    }
    setGroup(next)
  }

  if (!group) return error ? <p role="alert">{error}</p> : null
  return (
    <section aria-labelledby="group-title">
      <h2 id="group-title">Gruppe {group.name}</h2>
      {error && <p role="alert">{error}</p>}
      <p>Runde {group.round + 1}. Ihr spielt gemeinsam an einem Gerät. Die Rollen wechseln jede Runde.</p>
      <ol aria-label="Rollen in dieser Runde">
        {rolesFor(group.round).map((role, i) => (
          <li key={role}>Position {i + 1}: {role}</li>
        ))}
      </ol>
      <button type="button" onClick={nextRound}>Neue Runde</button>
    </section>
  )
}
