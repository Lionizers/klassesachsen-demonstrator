import { useEffect, useState } from 'preact/hooks'
import { load, save } from '../store/db'
import { PLACE_NAME, burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import type { ItemArt, Minigame } from '../minigames/model'
import { MINIGAMES_KEY, initialProgress, type Progress } from '../minigames/progress'
import { CHARACTER_KEY, collected, wornOf, type Character } from '../collection/items'
import type { ScreenProps } from './types'

// Drawn with the same path data as the items, so worn items line up with their `at` box.
const BODY = [
  { d: 'M42 106h10v18H42ZM60 106h10v18H60Z', fill: '#2f4b6e' },
  { d: 'M36 70c0-10 6-14 20-14s20 4 20 14v38H36Z', fill: '#4a7fb5' },
  { d: 'M36 66l-12 22l6 3l10-16ZM76 66l8 18l-5 3l-7-14Z', fill: '#4a7fb5' },
  { d: 'M36 36a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z', fill: '#f2c9a0' },
  { d: 'M47 33a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM59 33a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM49 43q7 6 14 0l-1.5-1.5q-5.5 4-11 0Z', fill: '#1b1b1f' },
]

/** Decorative: the item name is always written next to it. */
export function ItemImage({ art, size = 32 }: { art: ItemArt; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" class="item">
      {art.paths.map((p) => <path key={p.d} d={p.d} fill={p.fill} />)}
    </svg>
  )
}

export function Collection({ go }: ScreenProps) {
  // Empty until loaded, so the heading is there for focus right away.
  const [items, setItems] = useState<Minigame[]>([])
  const [worn, setWorn] = useState<string[]>([])
  const [error, setError] = useState<string>()

  useEffect(() => {
    Promise.all([load<Progress>(MINIGAMES_KEY), load<Character>(CHARACTER_KEY)]).then(
      ([progress, character]) => {
        const found = collected(GAMES, initialProgress(GAMES, progress))
        setItems(found)
        setWorn(wornOf(character, found))
      },
      () => setError('Die Sammlung konnte nicht geladen werden.'),
    )
  }, [])

  const toggle = (id: string) => {
    const next = worn.includes(id) ? worn.filter((w) => w !== id) : [...worn, id]
    setWorn(next)
    save(CHARACTER_KEY, { worn: next } satisfies Character).catch(() => setError('Der Charakter konnte nicht gespeichert werden.'))
  }

  const wornItems = items.filter((item) => worn.includes(item.id))
  const open = GAMES.filter((game) => !items.includes(game))
  return (
    <section aria-labelledby="collection-title">
      <h2 id="collection-title" tabIndex={-1}>Sammlung</h2>
      {error && <p role="alert">{error}</p>}
      <svg
        viewBox="0 0 112 128"
        class="character"
        role="img"
        aria-label={wornItems.length ? `Euer Charakter trägt: ${wornItems.map((i) => i.reward.standard).join(', ')}` : 'Euer Charakter trägt noch nichts.'}
      >
        {BODY.map((p) => <path key={p.d} d={p.d} fill={p.fill} />)}
        {wornItems.map((item) => (
          <g key={item.id} transform={`translate(${item.item.at.join(' ')})`}>
            {item.item.paths.map((p) => <path key={p.d} d={p.d} fill={p.fill} />)}
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
              <ItemImage art={item.item} /> {item.reward.standard}{' '}
              <button type="button" aria-pressed={worn.includes(item.id)} onClick={() => toggle(item.id)}>
                {item.reward.standard} tragen
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
                <span>{game.reward.standard}: <span class="hint">Station „{game.title.standard}“ bei {PLACE_NAME} schaffen</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" onClick={() => go('roles')}>Zurück zur Gruppe</button>
    </section>
  )
}
