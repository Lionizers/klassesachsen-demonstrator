import { useContext, useEffect, useState } from 'preact/hooks'
import { GROUP_KEY, MAX_NAME_LENGTH, SUGGESTED_NAMES, nameForCode, validateName, type Group } from '../group'
import { save } from '../store/db'
import { SettingsContext, text } from '../settings'
import { Fidelius } from '../fidelius'
import type { ScreenProps } from './types'

const CODE_HINT = { standard: 'Steht auf dem Zettel eurer Lehrkraft.', easy: 'Der Code steht auf eurem Zettel.' }
const UNKNOWN_CODE = { standard: 'Diesen Startcode gibt es nicht. Bitte prüft die Schreibweise.', easy: 'Diesen Code gibt es nicht. Schaut noch einmal auf euren Zettel.' }

export function GroupStart({ go, setGroup, startCode }: ScreenProps) {
  const { easy } = useContext(SettingsContext)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const nameError = validateName(name)

  useEffect(() => {
    if (startCode !== undefined) startWith(startCode)
  }, [])

  function startWith(startCode: string) {
    const found = nameForCode(startCode)
    if (found) create(found)
    else setError(text(UNKNOWN_CODE, easy))
  }

  async function create(groupName: string) {
    const group: Group = { name: groupName.trim(), round: 0, createdAt: Date.now() }
    try {
      await save(GROUP_KEY, group)
    } catch {
      setError('Die Gruppe konnte nicht gespeichert werden.')
      return
    }
    setGroup(group)
    go('roles')
  }

  return (
    <section aria-labelledby="start-title">
      <h2 id="start-title" tabIndex={-1}>Wie heißt eure Gruppe?</h2>
      {error && <p role="alert">{error}</p>}
      <Fidelius>Hallo! Ich bin Fuchs Fidelius und begleite euch auf der Entdeckerreise. Ihr braucht kein Konto. Wählt einen Namen für eure Gruppe.</Fidelius>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          startWith(code)
        }}
      >
        <label for="start-code">Startcode</label>
        <p id="start-code-hint" class="hint">{text(CODE_HINT, easy)}</p>
        <input id="start-code" aria-describedby="start-code-hint" autoComplete="off" value={code} onInput={(e) => setCode(e.currentTarget.value)} />
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
          if (!nameError) create(name)
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
        <p id="own-name-error" class="error" role="status">{nameError ?? ''}</p>
        <button type="submit" disabled={!!nameError}>Gruppe anlegen</button>
      </form>
    </section>
  )
}
