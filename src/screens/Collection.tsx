import { useContext, useEffect, useState } from 'preact/hooks'
import { load, save } from '../store/db'
import { PLACE_NAME, burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import type { Minigame } from '../minigames/model'
import { MINIGAMES_KEY, initialProgress, placeState, type Progress } from '../minigames/progress'
import { CHARACTER_KEY, collected, wornOf, type Character } from '../collection/items'
import { ArtPaths, BODY, CHARACTER_VIEWBOX, ItemImage } from '../collection/ItemArt'
import { SettingsContext, text } from '../settings'
import { Collage } from '../collage/Collage'
import type { ScreenProps } from './types'

export function Collection({ go }: ScreenProps) {
  const { easy } = useContext(SettingsContext)
  const [items, setItems] = useState<Minigame[]>()
  const [worn, setWorn] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    Promise.all([load<Progress>(MINIGAMES_KEY), load<Character>(CHARACTER_KEY)]).then(
      ([progress, character]) => {
        const state = initialProgress(GAMES, progress)
        const found = collected(GAMES, state)
        setItems(found)
        setFinished(placeState(state) === 'done')
        setWorn(wornOf(character, found))
      },
      () => setError('Die Sammlung konnte nicht geladen werden.'),
    )
  }, [])

  const toggle = (id: string) => {
    const next = worn.includes(id) ? worn.filter((w) => w !== id) : [...worn, id]
    setWorn(next)
    save(CHARACTER_KEY, { worn: next } satisfies Character).then(
      () => setError(undefined),
      () => {
        // The character shows only what is stored, so a reload brings no surprise.
        setWorn(worn)
        setError('Der Charakter konnte nicht gespeichert werden.')
      },
    )
  }

  const alert = error && <p role="alert">{error}</p>
  const heading = <h2 id="collection-title" tabIndex={-1}>Sammlung</h2>
  const back = <button type="button" onClick={() => go('roles')}>Zurück zur Gruppe</button>
  // The heading is there before the items, so the focus moved to it on arrival has a target.
  if (!items) return <section aria-labelledby="collection-title">{alert}{heading}{back}</section>

  const wornItems = items.filter((item) => worn.includes(item.id))
  const open = GAMES.filter((game) => !items.includes(game))
  return (
    <section aria-labelledby="collection-title">
      {alert}
      {heading}
      <svg
        viewBox={CHARACTER_VIEWBOX}
        class="character"
        role="img"
        aria-label={wornItems.length ? `Euer Charakter trägt: ${wornItems.map((i) => text(i.reward, easy)).join(', ')}` : 'Euer Charakter trägt noch nichts.'}
      >
        <ArtPaths paths={BODY} />
        {wornItems.map((item) => (
          <g key={item.id} transform={`translate(${item.item.at.join(' ')})`}>
            <ArtPaths paths={item.item.paths} />
          </g>
        ))}
      </svg>
      <h3>Gesammelt</h3>
      {items.length === 0 ? (
        <p>Noch nichts gesammelt.</p>
      ) : (
        <ul aria-label="Gesammelt" class="items">
          {items.map((item) => (
            <li key={item.id}>
              <ItemImage art={item.item} /> {text(item.reward, easy)}{' '}
              <button type="button" aria-pressed={worn.includes(item.id)} onClick={() => toggle(item.id)}>
                {text(item.reward, easy)} tragen
              </button>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && (
        <>
          <h3>Noch offen</h3>
          <ul aria-label="Noch offen" class="items">
            {open.map((game) => (
              <li key={game.id} class="open">
                <ItemImage art={game.item} />
                <span>{text(game.reward, easy)}: <span class="hint">Station „{text(game.title, easy)}“ bei {PLACE_NAME} schaffen</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Collage items={items} unlocked={finished} />
      {back}
    </section>
  )
}
