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
    await save('group', next)
    setGroup(next)
  }

  if (error) return <p role="alert">{error}</p>
  if (!group) return null
  return (
    <section aria-labelledby="group-title">
      <h2 id="group-title">Gruppe {group.name}</h2>
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
