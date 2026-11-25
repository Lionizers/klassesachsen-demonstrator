import { useContext, useEffect, useRef, useState } from 'preact/hooks'
import { rolesFor, type Group, type Role } from '../group'
import { focusHeading } from '../focus'
import { load, save } from '../store/db'
import { ItemImage, ItemProgress } from '../collection/ItemArt'
import { collected } from '../collection/items'
import { Fidelius } from '../fidelius'
import { DemoSolveHelp } from '../demo/DemoHelp'
import { ReadAloud, SettingsContext, playSuccessTone, text } from '../settings'
import { ASK_FOR_HELP, GUIDE_NAME, PLACE_DONE, PLACE_NAME, PLACE_WELCOME, burgFunkelfels as GAMES } from './burg-funkelfels'
import { dilemmaOutcome, estimateResult, isEstimateCorrect, isPuzzleSolved, unreachable, voteSummary, type Dilemma, type Estimate, type Minigame, type Puzzle, type Text } from './model'
import { MINIGAMES_KEY, countEvents, initialProgress, placeState, reduceProgress, type Progress, type ProgressAction } from './progress'

const STATUS_LABEL = { open: 'offen', skipped: 'später nachholen', done: 'geschafft' }
const PLACE_LABEL = { new: 'Noch nicht begonnen.', started: 'Angefangen.', done: 'Alle Stationen geschafft!' }

type Apply = (...actions: ProgressAction[]) => Promise<boolean>
type Result = { game: Minigame; consequence?: Text }

type Props = { group: Group | undefined; onBack: () => void; onCollage: () => void }

export function Place({ group, onBack, onCollage }: Props) {
  const settings = useContext(SettingsContext)
  const { easy } = settings
  const [progress, setProgress] = useState<Progress>()
  const [active, setActive] = useState<Minigame>()
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    load<Progress>(MINIGAMES_KEY).then(
      (stored) => setProgress(initialProgress(GAMES, stored)),
      () => setError('Der Spielstand konnte nicht geladen werden.'),
    )
  }, [])

  // Shown above the still usable view, so a failed save never locks the group out.
  const alert = error && <p role="alert">{error}</p>
  const heading = <h2 id="place-title" tabIndex={-1}>{PLACE_NAME}</h2>
  const back = <button type="button" onClick={onBack}>Zurück zur Karte</button>
  // The heading is there before the progress, so the focus moved to it on arrival has a target.
  if (!progress) return <section aria-labelledby="place-title">{alert}{heading}{back}</section>

  const show = (next: { active?: Minigame; result?: Result }) => {
    setActive(next.active)
    setResult(next.result)
    focusHeading()
  }

  /** Resolves true once stored; a failed save is shown, not thrown. */
  const apply: Apply = (...actions) => {
    const next = actions.reduce(reduceProgress, progress)
    setProgress(next)
    return save(MINIGAMES_KEY, next).then(
      () => true,
      () => {
        setError('Der Spielstand konnte nicht gespeichert werden.')
        return false
      },
    )
  }

  if (result) {
    const earned = `Neues Item: ${text(result.game.reward, easy)}`
    return (
      <section aria-labelledby="result-title">
        {alert}
        <h2 id="result-title" tabIndex={-1}>{text(result.game.title, easy)}: geschafft!</h2>
        {result.consequence && (
          <div class="said">
            <p>{text(result.consequence, easy)}</p>
            <ReadAloud text={text(result.consequence, easy)} />
          </div>
        )}
        <div class="earned">
          <div class="prize">
            <svg viewBox="-50 -50 100 100" class="burst" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d="M-4 -28 L0 -48 L4 -28 Z" fill={i % 2 ? '#ffd166' : '#f4845f'} transform={`rotate(${i * 30})`} />
              ))}
            </svg>
            <ItemImage art={result.game.item} size={128} />
          </div>
          <p>{earned}</p>
        </div>
        <ReadAloud text={earned} />
        <ItemProgress games={GAMES} found={collected(GAMES, progress)} />
        <button type="button" onClick={() => show({})}>Zurück zur Übersicht von {PLACE_NAME}</button>
      </section>
    )
  }

  if (active) {
    return (
      <>
        {alert}
        <Station
          key={active.id}
          game={active}
          roles={rolesFor(group?.round ?? 0)}
          hintsShown={countEvents(progress, 'E5', active.id)}
          attempts={countEvents(progress, 'E3', active.id)}
          apply={apply}
          onBack={() => show({})}
          onDone={(consequence) => {
            show({ result: { game: active, consequence } })
            if (settings.sound) playSuccessTone()
          }}
          onSkip={() => {
            apply({ type: 'skip', id: active.id, at: Date.now() })
            show({})
          }}
          />
      </>
    )
  }

  const state = placeState(progress)
  return (
    <section aria-labelledby="place-title">
      {alert}
      {heading}
      <Fidelius>{text(state === 'done' ? PLACE_DONE : PLACE_WELCOME, easy)}</Fidelius>
      <p>{PLACE_LABEL[state]}</p>
      {state === 'done' && <button type="button" class="primary" onClick={onCollage}>Zur Collage</button>}
      <ItemProgress games={GAMES} found={collected(GAMES, progress)} />
      <ul aria-label="Stationen" class="tiles">
        {GAMES.map((game) => {
          const status = progress.status[game.id]
          const icon = <ItemImage art={game.item} size={56} />
          return (
            <li key={game.id} class={`tile status-${status}`}>
              {status === 'done' ? (
                <span class="tile-main">{icon}<span class="tile-name">{text(game.title, easy)}</span></span>
              ) : (
                <button
                  type="button"
                  class="tile-main"
                  onClick={() => {
                    apply({ type: 'open', id: game.id, at: Date.now() })
                    show({ active: game })
                  }}
                >
                  {icon}<span class="tile-name">{text(game.title, easy)}</span>
                </button>
              )}
              <span class="pill">{STATUS_LABEL[status]}</span>
            </li>
          )
        })}
      </ul>
      {state !== 'done' && <DemoSolveHelp ids={GAMES.map((g) => g.id)} apply={apply} onSolved={onCollage} />}
      {back}
    </section>
  )
}

type StationProps = {
  game: Minigame
  roles: Role[]
  hintsShown: number
  attempts: number
  apply: Apply
  onDone: (consequence?: Text) => void
  onBack: () => void
  onSkip: () => void
}

function Station({ game, roles, hintsShown, attempts, apply, onDone, onBack, onSkip }: StationProps) {
  const { easy } = useContext(SettingsContext)
  const allHintsShown = hintsShown >= game.hints.length
  const attempt = (correct: boolean, consequence?: Text) => {
    apply({ type: 'attempt', id: game.id, correct, at: Date.now() })
    if (correct) onDone(consequence)
  }

  return (
    <section aria-labelledby="game-title">
      <div class="station-title">
        <h2 id="game-title" tabIndex={-1}>{text(game.title, easy)}</h2>
        <p class="reward pill"><ItemImage art={game.item} size={28} /> Belohnung: {text(game.reward, easy)}</p>
        <p class="station-count">Station {GAMES.indexOf(game) + 1} von {GAMES.length}</p>
      </div>
      <div class="station">
        <div>
          <div class="said">
            <p>{text(game.prompt, easy)}</p>
            <ReadAloud text={text(game.prompt, easy)} />
          </div>
          <Fidelius live>
            {hintsShown === 0 && <p>{text(ASK_FOR_HELP, easy)}</p>}
            {game.hints.slice(0, hintsShown).map((hint) => (
              <div class="said" key={hint.standard}>
                {/* The live region announces only the added text, so it names the speaker. */}
                <p><span class="visually-hidden">{GUIDE_NAME}: </span>{text(hint, easy)}</p>
                <ReadAloud text={text(hint, easy)} />
              </div>
            ))}
          </Fidelius>
          {/* aria-disabled instead of disabled: a disabled button would drop the keyboard focus to body. */}
          <button
            type="button"
            aria-disabled={allHintsShown}
            onClick={() => {
              if (!allHintsShown) apply({ type: 'hint', id: game.id, index: hintsShown, at: Date.now() })
            }}
          >
            {GUIDE_NAME} um Hilfe bitten
          </button>
        </div>
        <div class="play">{gameView()}</div>
      </div>
      <div class="actions">
        <button type="button" onClick={onBack}>Zurück zu {PLACE_NAME}</button>
        <button type="button" class="text" onClick={onSkip}>Später nachholen</button>
      </div>
    </section>
  )

  function gameView() {
    switch (game.kind) {
      case 'puzzle':
        return <PuzzleView game={game} attempts={attempts} attempt={attempt} />
      case 'estimate':
        return <EstimateView game={game} attempts={attempts} attempt={attempt} />
      case 'dilemma':
        return <DilemmaView game={game} roles={roles} apply={apply} onDone={onDone} />
      default:
        return unreachable(game)
    }
  }
}

type GameViewProps<G> = { game: G; attempts: number; attempt: (correct: boolean, consequence?: Text) => void }

function PuzzleView({ game, attempts, attempt }: GameViewProps<Puzzle>) {
  const { easy } = useContext(SettingsContext)
  const [order, setOrder] = useState(() => game.pieces.map((_, i) => i))
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<{ from: number; over?: number }>()
  // The latest order for handlers that outlive their render, so a drop never undoes an arrow press made meanwhile.
  const current = useRef(order)
  current.current = order
  const stopDrag = useRef<() => void>()
  useEffect(() => () => stopDrag.current?.(), [])

  /** Takes the piece at `i` out, puts it in at `j` and says where it is now; returns its label. */
  const place = (i: number, j: number) => {
    const next = [...current.current]
    next.splice(j, 0, ...next.splice(i, 1))
    const label = text(game.pieces[current.current[i]], easy)
    current.current = next
    setOrder(next)
    setMessage(`„${label}“ jetzt an Stelle ${j + 1}.`)
    return label
  }
  const move = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return
    const label = place(i, j)
    // Reordering the list can move the focused button out of the DOM; keep the focus on the moved piece.
    const direction = j < i ? 'nach oben' : 'nach unten'
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-label="${label} ${direction}"]`)?.focus())
  }

  /**
   * Follows one pointer on the window, so the drag goes on when finger or mouse leave the grip.
   * Registered right in pointerdown: an effect would come a render late and miss a quick release.
   * Other pointers (a second finger, a palm on a shared iPad) are ignored.
   */
  const startDrag = (e: PointerEvent, piece: number) => {
    if (stopDrag.current || !e.isPrimary || e.button !== 0) return
    const from = () => current.current.indexOf(piece)
    const at = (ev: PointerEvent) => {
      const li = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.pieces li')
      return li ? Number(li.dataset.index) : undefined
    }
    let over: number | undefined = from()
    const mine = (ev: PointerEvent) => ev.pointerId === e.pointerId
    const onMove = (ev: PointerEvent) => {
      if (!mine(ev) || at(ev) === over) return
      over = at(ev)
      setDrag({ from: from(), over })
    }
    const onUp = (ev: PointerEvent) => {
      if (!mine(ev)) return
      stop()
      const j = at(ev)
      if (j !== undefined && j !== from()) place(from(), j)
    }
    const onCancel = (ev: PointerEvent) => mine(ev) && stop()
    const stop = () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onCancel)
      stopDrag.current = undefined
      setDrag(undefined)
    }
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', onUp)
    addEventListener('pointercancel', onCancel)
    stopDrag.current = stop
    setDrag({ from: from(), over })
  }

  return (
    <>
      <ol aria-label="Reihenfolge" class="pieces">
        {order.map((piece, i) => {
          const label = text(game.pieces[piece], easy)
          return (
            <li
              key={piece}
              data-index={i}
              class={drag?.from === i ? 'dragging' : drag && drag.over === i ? 'target' : undefined}
            >
              {/* Pointer only: the arrows are the way without dragging (WCAG 2.5.7), so the grip stays out of the tab order and the reading. */}
              <span
                class="grip"
                aria-hidden="true"
                onPointerDown={(e) => {
                  e.preventDefault()
                  startDrag(e, piece)
                }}
              >
                <svg viewBox="0 0 16 16" width="20" height="20"><path d="M5 3h2v2H5zm4 0h2v2H9zM5 7h2v2H5zm4 0h2v2H9zm-4 4h2v2H5zm4 0h2v2H9z" fill="currentColor" /></svg>
              </span>
              <span>{label}</span>{' '}
              {/* aria-disabled instead of disabled: the focused button must stay focusable at the edge. */}
              <button type="button" aria-label={`${label} nach oben`} aria-disabled={i === 0} onClick={() => move(i, i - 1)}><Arrow /></button>{' '}
              <button type="button" aria-label={`${label} nach unten`} aria-disabled={i === order.length - 1} onClick={() => move(i, i + 1)}><Arrow down /></button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        class="primary"
        onClick={() => {
          const correct = isPuzzleSolved(game, order)
          // The attempt number makes a repeated failure a new text, so screen readers announce it again.
          if (!correct) setMessage(`Versuch ${attempts + 1}: Noch nicht ganz. Probiert eine andere Reihenfolge!`)
          attempt(correct)
        }}
      >
        Prüfen
      </button>
      <p role="status">{message}</p>
    </>
  )
}

// A drawn arrow instead of the ↑/↓ glyph: axe cannot measure the contrast of a symbol-only text.
const Arrow = ({ down }: { down?: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M8 2 L14 9 H10 V14 H6 V9 H2 Z" fill="currentColor" />
  </svg>
)

function EstimateView({ game, attempts, attempt }: GameViewProps<Estimate>) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState('')
  const empty = value.trim() === ''
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (empty) {
          setFeedback('Gebt zuerst eure Schätzung als Zahl ein.')
          return
        }
        const answer = Number(value)
        const correct = isEstimateCorrect(game, answer)
        setFeedback(correct ? '' : `Versuch ${attempts + 1}: Eure Schätzung ist zu ${answer > game.target ? 'hoch' : 'niedrig'}. Versucht es noch einmal!`)
        attempt(correct, correct ? estimateResult(game, answer) : undefined)
      }}
    >
      <label for="estimate">Eure Schätzung ({game.unit})</label>
      <input id="estimate" type="number" inputMode="numeric" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
      {/* Always active: an empty field gets a hint instead of a dead button. */}
      <button type="submit" class="primary">Prüfen</button>
      <p role="status">{feedback}</p>
    </form>
  )
}

type DilemmaProps = { game: Dilemma; roles: Role[]; apply: Apply; onDone: (consequence: Text) => void }

// Votes live only in this component: storing who chose what would identify individual children.
function DilemmaView({ game, roles, apply, onDone }: DilemmaProps) {
  const { easy } = useContext(SettingsContext)
  const [votes, setVotes] = useState<Partial<Record<Role, 0 | 1>>>({})
  const position = Object.keys(votes).length
  const voter = roles[position]

  const vote = (option: 0 | 1) => {
    const next = { ...votes, [voter]: option }
    const at = Date.now()
    const voteAction: ProgressAction = { type: 'vote', id: game.id, position: position + 1, at }
    if (position + 1 < roles.length) {
      apply(voteAction)
      setVotes(next)
      return
    }
    const all = next as Record<Role, 0 | 1>
    const outcome = dilemmaOutcome(all)
    apply(voteAction, { type: 'decide', id: game.id, option: outcome, at })
    const summary = voteSummary(game, all)
    const { consequence } = game.options[outcome]
    onDone({ standard: `${summary.standard}. ${consequence.standard}`, easy: `${summary.easy}. ${consequence.easy}` })
  }

  return (
    <div>
      <h3 aria-live="polite">Position {position + 1}: {voter} stimmt ab</h3>
      <p>Stimme {position + 1} von {roles.length}. Die anderen schauen bitte kurz weg.</p>
      <ul class="choices options">
        {game.options.map((option, i) => (
          <li key={i}><button type="button" onClick={() => vote(i as 0 | 1)}>{text(option.label, easy)}</button></li>
        ))}
      </ul>
    </div>
  )
}
