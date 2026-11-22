import { useState } from 'preact/hooks'
import { GROUP_KEY, MAX_NAME_LENGTH, SUGGESTED_NAMES, validateName, type Group } from '../group'
import { save } from '../store/db'
import type { ScreenProps } from './types'

export function GroupStart({ go, setGroup }: ScreenProps) {
  const [name, setName] = useState('')
  const [saveError, setSaveError] = useState<string>()
  const error = validateName(name)

  async function create(groupName: string) {
    const group: Group = { name: groupName.trim(), round: 0 }
    try {
      await save(GROUP_KEY, group)
    } catch {
      setSaveError('Die Gruppe konnte nicht gespeichert werden.')
      return
    }
    setGroup(group)
    go('roles')
  }

  return (
    <section aria-labelledby="start-title">
      <h2 id="start-title" tabIndex={-1}>Wie heißt eure Gruppe?</h2>
      {saveError && <p role="alert">{saveError}</p>}
      <p>Ihr braucht kein Konto. Wählt einen Namen für eure Gruppe.</p>
      <ul aria-label="Vorschläge" class="choices">
        {SUGGESTED_NAMES.map((n) => (
          <li key={n}>
            <button type="button" aria-label={`Gruppe ${n}`} onClick={() => create(n)}>{n}</button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!error) create(name)
        }}
      >
        <label for="own-name">Eigener Gruppenname</label>
        <p id="own-name-hint" class="hint">Bitte keine Namen von Kindern verwenden, auch keine Teile davon.</p>
        <input
          id="own-name"
          maxLength={MAX_NAME_LENGTH}
          aria-describedby="own-name-hint own-name-error"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <p id="own-name-error" class="error" role="status">{error ?? ''}</p>
        <button type="submit" disabled={!!error}>Gruppe anlegen</button>
      </form>
    </section>
  )
}
