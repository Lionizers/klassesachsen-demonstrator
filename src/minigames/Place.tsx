import { useEffect, useState } from 'preact/hooks'
import { rolesFor, type Role } from '../group'
import { focusHeading } from '../focus'
import { load, save } from '../store/db'
import type { ScreenProps } from '../screens/types'
import { GUIDE_NAME, PLACE_NAME, burgFunkelfels as GAMES } from './burg-funkelfels'
import { dilemmaOutcome, isEstimateCorrect, isPuzzleSolved, unreachable, type Dilemma, type Estimate, type Minigame, type Puzzle } from './model'
import { MINIGAMES_KEY, countEvents, initialProgress, placeState, reduceProgress, type Progress, type ProgressAction } from './progress'

const STATUS_LABEL = { open: 'offen', skipped: 'später nachholen', done: 'geschafft' }
const PLACE_LABEL = { new: 'Noch nicht begonnen.', started: 'Angefangen', done: 'Alle Stationen geschafft!' }

type Apply = (...actions: ProgressAction[]) => void
type Result = { game: Minigame; consequence?: string }

export function Place({ go, group }: ScreenProps) {
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
  if (!progress) return alert || null

  const show = (next: { active?: Minigame; result?: Result }) => {
    setActive(next.active)
    setResult(next.result)
    focusHeading()
  }

  const apply: Apply = (...actions) => {
    const next = actions.reduce(reduceProgress, progress)
    setProgress(next)
    save(MINIGAMES_KEY, next).catch(() => setError('Der Spielstand konnte nicht gespeichert werden.'))
  }

  if (result) {
    return (
      <section aria-labelledby="result-title">
        {alert}
        <h2 id="result-title" tabIndex={-1}>{result.game.title.standard}: geschafft!</h2>
        {result.consequence && <p>{result.consequence}</p>}
        <p>Du erhältst: {result.game.reward.standard}</p>
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
          onDone={(consequence) => show({ result: { game: active, consequence } })}
          onSkip={() => {
            apply({ type: 'skip', id: active.id, at: Date.now() })
            show({})
          }}
          />
      </>
    )
  }

  const state = placeState(progress)
  const doneCount = Object.values(progress.status).filter((s) => s === 'done').length
  return (
    <section aria-labelledby="place-title">
      {alert}
      <h2 id="place-title" tabIndex={-1}>{PLACE_NAME}</h2>
      <p>{GUIDE_NAME} begrüßt euch am Burgtor. Wählt eine Station, die Reihenfolge ist euch überlassen.</p>
      <p>
        {PLACE_LABEL[state]}
        {state === 'started' && `: ${doneCount} von ${GAMES.length} Stationen geschafft.`}
      </p>
      <ul aria-label="Stationen">
        {GAMES.map((game) => {
          const status = progress.status[game.id]
          return (
            <li key={game.id}>
              {status === 'done' ? (
                <span>{game.title.standard}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    apply({ type: 'open', id: game.id, at: Date.now() })
                    show({ active: game })
                  }}
                >
                  {game.title.standard}
                </button>
              )}{' '}
              <span class="hint">({STATUS_LABEL[status]})</span>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => go('roles')}>Zurück zur Gruppe</button>
    </section>
  )
}

type StationProps = {
  game: Minigame
  roles: Role[]
  hintsShown: number
  attempts: number
  apply: Apply
  onDone: (consequence?: string) => void
  onSkip: () => void
}

function Station({ game, roles, hintsShown, attempts, apply, onDone, onSkip }: StationProps) {
  const allHintsShown = hintsShown >= game.hints.length
  const attempt = (correct: boolean) => {
    apply({ type: 'attempt', id: game.id, correct, at: Date.now() })
    if (correct) onDone()
  }

  return (
    <section aria-labelledby="game-title">
      <h2 id="game-title" tabIndex={-1}>{game.title.standard}</h2>
      <p>{game.prompt.standard}</p>
      {gameView()}
      <div aria-live="polite">
        {game.hints.slice(0, hintsShown).map((hint) => (
          <p key={hint.standard}>{GUIDE_NAME}: {hint.standard}</p>
        ))}
      </div>
      {/* aria-disabled instead of disabled: a disabled button would drop the keyboard focus to body. */}
      <button
        type="button"
        aria-disabled={allHintsShown}
        onClick={() => {
          if (!allHintsShown) apply({ type: 'hint', id: game.id, index: hintsShown, at: Date.now() })
        }}
      >
        {GUIDE_NAME} um Hilfe bitten
      </button>{' '}
      <button type="button" onClick={onSkip}>Später nachholen</button>
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

type GameViewProps<G> = { game: G; attempts: number; attempt: (correct: boolean) => void }

function PuzzleView({ game, attempts, attempt }: GameViewProps<Puzzle>) {
  const [order, setOrder] = useState(() => game.pieces.map((_, i) => i))
  const [message, setMessage] = useState('')
  const move = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    const text = game.pieces[order[i]].standard
    setMessage(`„${text}“ jetzt an Stelle ${j + 1}.`)
    // Reordering the list can move the focused button out of the DOM; keep the focus on the moved piece.
    const direction = j < i ? 'nach oben' : 'nach unten'
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-label="${text} ${direction}"]`)?.focus())
  }

  return (
    <>
      <ol aria-label="Reihenfolge">
        {order.map((piece, i) => {
          const text = game.pieces[piece].standard
          return (
            <li key={piece}>
              <span>{text}</span>{' '}
              {/* aria-disabled instead of disabled: the focused button must stay focusable at the edge. */}
              <button type="button" aria-label={`${text} nach oben`} aria-disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>{' '}
              <button type="button" aria-label={`${text} nach unten`} aria-disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>↓</button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
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

function EstimateView({ game, attempts, attempt }: GameViewProps<Estimate>) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const answer = Number(value)
        const correct = isEstimateCorrect(game, answer)
        setFeedback(correct ? '' : `Versuch ${attempts + 1}: Eure Schätzung ist zu ${answer > game.target ? 'hoch' : 'niedrig'}. Versucht es noch einmal!`)
        attempt(correct)
      }}
    >
      <label for="estimate">Eure Schätzung ({game.unit})</label>
      <input id="estimate" type="number" inputMode="numeric" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
      <button type="submit" disabled={value.trim() === ''}>Prüfen</button>
      <p role="status">{feedback}</p>
    </form>
  )
}

type DilemmaProps = { game: Dilemma; roles: Role[]; apply: Apply; onDone: (consequence: string) => void }

// Votes live only in this component: storing who chose what would identify individual children.
function DilemmaView({ game, roles, apply, onDone }: DilemmaProps) {
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
    const outcome = dilemmaOutcome(next as Record<Role, 0 | 1>)
    apply(voteAction, { type: 'decide', id: game.id, option: outcome, at })
    onDone(game.options[outcome].consequence.standard)
  }

  return (
    <div>
      <h3 aria-live="polite">Position {position + 1}: {voter} stimmt ab</h3>
      <p>Stimme {position + 1} von {roles.length}. Die anderen schauen bitte kurz weg.</p>
      {game.options.map((option, i) => (
        <button key={i} type="button" onClick={() => vote(i as 0 | 1)}>{option.label.standard}</button>
      ))}
    </div>
  )
}
