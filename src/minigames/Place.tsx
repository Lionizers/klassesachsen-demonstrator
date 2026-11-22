import { useEffect, useState } from 'preact/hooks'
import { rolesFor, type Role } from '../group'
import { load, save } from '../store/db'
import type { ScreenProps } from '../screens/types'
import { GUIDE_NAME, PLACE_NAME, burgFunkelfels as GAMES } from './burg-funkelfels'
import { dilemmaOutcome, isEstimateCorrect, isPuzzleSolved, type Dilemma, type Estimate, type Minigame, type Puzzle } from './model'
import { MINIGAMES_KEY, initialProgress, placeState, reduceProgress, type Progress, type ProgressAction } from './progress'

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
      (stored) => setProgress(stored ?? initialProgress(GAMES)),
      () => setError('Der Spielstand konnte nicht geladen werden.'),
    )
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!progress) return null

  const apply: Apply = (...actions) => {
    const next = actions.reduce(reduceProgress, progress)
    setProgress(next)
    save(MINIGAMES_KEY, next).catch(() => setError('Der Spielstand konnte nicht gespeichert werden.'))
  }

  if (result) {
    return (
      <section aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1}>{result.game.title.standard}: geschafft!</h2>
        {result.consequence && <p>{result.consequence}</p>}
        <p>Du erhältst: {result.game.reward.standard}</p>
        <button type="button" onClick={() => setResult(undefined)}>Zurück zur Burg</button>
      </section>
    )
  }

  if (active) {
    return (
      <Station
        key={active.id}
        game={active}
        roles={rolesFor(group?.round ?? 0)}
        apply={apply}
        onDone={(consequence) => {
          setActive(undefined)
          setResult({ game: active, consequence })
        }}
        onSkip={() => {
          apply({ type: 'skip', id: active.id, at: Date.now() })
          setActive(undefined)
        }}
      />
    )
  }

  const state = placeState(progress)
  const doneCount = Object.values(progress.status).filter((s) => s === 'done').length
  return (
    <section aria-labelledby="place-title">
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
                    setActive(game)
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
  apply: Apply
  onDone: (consequence?: string) => void
  onSkip: () => void
}

function Station({ game, roles, apply, onDone, onSkip }: StationProps) {
  const [hintsShown, setHintsShown] = useState(0)
  const attempt = (correct: boolean) => {
    apply({ type: 'attempt', id: game.id, correct, at: Date.now() })
    if (correct) onDone()
  }

  return (
    <section aria-labelledby="game-title">
      <h2 id="game-title" tabIndex={-1}>{game.title.standard}</h2>
      <p>{game.prompt.standard}</p>
      {game.kind === 'puzzle' && <PuzzleView game={game} attempt={attempt} />}
      {game.kind === 'estimate' && <EstimateView game={game} attempt={attempt} />}
      {game.kind === 'dilemma' && <DilemmaView game={game} roles={roles} apply={apply} onDone={onDone} />}
      <div>
        {game.hints.slice(0, hintsShown).map((hint) => (
          <p key={hint.standard}>{GUIDE_NAME}: {hint.standard}</p>
        ))}
        <button
          type="button"
          disabled={hintsShown === game.hints.length}
          onClick={() => {
            apply({ type: 'hint', id: game.id, index: hintsShown, at: Date.now() })
            setHintsShown(hintsShown + 1)
          }}
        >
          {GUIDE_NAME} um Hilfe bitten
        </button>
      </div>
      <button type="button" onClick={onSkip}>Später nachholen</button>
    </section>
  )
}

function PuzzleView({ game, attempt }: { game: Puzzle; attempt: (correct: boolean) => void }) {
  const [order, setOrder] = useState(() => game.pieces.map((_, i) => i))
  const [wrong, setWrong] = useState(false)
  const swap = (i: number, j: number) => {
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  return (
    <>
      <ol aria-label="Reihenfolge">
        {order.map((piece, i) => {
          const text = game.pieces[piece].standard
          return (
            <li key={piece}>
              <span>{text}</span>{' '}
              <button type="button" aria-label={`${text} nach oben`} disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>{' '}
              <button type="button" aria-label={`${text} nach unten`} disabled={i === order.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={() => {
          const correct = isPuzzleSolved(game, order)
          setWrong(!correct)
          attempt(correct)
        }}
      >
        Prüfen
      </button>
      <p role="status">{wrong ? 'Noch nicht ganz. Probiert eine andere Reihenfolge!' : ''}</p>
    </>
  )
}

function EstimateView({ game, attempt }: { game: Estimate; attempt: (correct: boolean) => void }) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const answer = Number(value)
        const correct = isEstimateCorrect(game, answer)
        setFeedback(correct ? '' : `Eure Schätzung ist zu ${answer > game.target ? 'hoch' : 'niedrig'}. Versucht es noch einmal!`)
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
      <h3>Position {position + 1}: {voter} stimmt ab</h3>
      <p>Stimme {position + 1} von {roles.length}. Die anderen schauen bitte kurz weg.</p>
      {game.options.map((option, i) => (
        <button key={i} type="button" onClick={() => vote(i as 0 | 1)}>{option.label.standard}</button>
      ))}
    </div>
  )
}
