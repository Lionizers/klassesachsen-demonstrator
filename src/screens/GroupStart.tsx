import { useEffect, useState } from 'preact/hooks'
import { GROUP_KEY, MAX_NAME_LENGTH, SUGGESTED_NAMES, nameForCode, validateName, type Group } from '../group'
import { save } from '../store/db'
import type { ScreenProps } from './types'

export function GroupStart({ go, setGroup }: ScreenProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string>()
  const [saveError, setSaveError] = useState<string>()
  const error = validateName(name)

  useEffect(() => {
    const fromQr = new URLSearchParams(location.search).get('start')
    if (fromQr === null) return
    // Dropped from the address, so this screen does not start the group again after its data was deleted.
    history.replaceState(null, '', location.pathname)
    startWith(fromQr)
  }, [])

  function startWith(startCode: string) {
    const found = nameForCode(startCode)
    if (found) create(found)
    else setCodeError('Diesen Startcode gibt es nicht. Bitte prüft die Schreibweise.')
  }

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
      <form
        onSubmit={(e) => {
          e.preventDefault()
          startWith(code)
        }}
      >
        <label for="start-code">Startcode</label>
        <p id="start-code-hint" class="hint">Steht auf dem Zettel eurer Lehrkraft.</p>
        <input id="start-code" aria-describedby="start-code-hint" autoComplete="off" value={code} onInput={(e) => setCode(e.currentTarget.value)} />
        {codeError && <p role="alert">{codeError}</p>}
        <button type="submit">Mit Startcode starten</button>
      </form>
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
