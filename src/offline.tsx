import { useEffect, useState } from 'preact/hooks'
import { KV_SAVED, load, save } from './store/db'
import { MINIGAMES_KEY, SYNC_KEY, type GameEvent, type Progress } from './minigames/progress'

/** The stored minigame events are the queue; `cursor` counts those already synced, `at` is the last sync time (E10). */
export type SyncState = { cursor: number; at?: number }

/** Index of the first unsynced event; a cursor beyond the events means they were reset, so all of them are new. */
function start(events: number, state: SyncState | undefined): number {
  const cursor = state?.cursor ?? 0
  return cursor > events ? 0 : cursor
}

export function pendingCount(events: number, state: SyncState | undefined): number {
  return events - start(events, state)
}

/** Moves the cursor only after upload and save both succeeded, so a failure never drops a result from the queue. */
export async function syncQueue(
  events: GameEvent[],
  state: SyncState,
  upload: (events: GameEvent[]) => Promise<void>,
  persist: (state: SyncState) => Promise<void>,
  now: () => number = Date.now,
): Promise<SyncState> {
  const from = start(events.length, state)
  if (events.length === from) return state
  await upload(events.slice(from))
  const next = { cursor: events.length, at: now() }
  await persist(next)
  return next
}

/** Runs `task` after the previous run has settled, so an older run cannot write back a smaller cursor after a newer one. */
export function serialized(task: () => Promise<void>, onError: (e: unknown) => void): () => Promise<void> {
  let running = Promise.resolve()
  return () => (running = running.then(task).catch(onError))
}

/** Stand-in for the server the demonstrator does not have: it accepts everything, but only with network. */
async function uploadToSimulation(): Promise<void> {
  if (!navigator.onLine) throw new Error('offline')
}

async function precachedKB(): Promise<number> {
  let bytes = 0
  for (const name of (await caches.keys()).filter((n) => n.startsWith('workbox-precache'))) {
    const cache = await caches.open(name)
    for (const response of await cache.matchAll()) bytes += (await response.blob()).size
  }
  return Math.round(bytes / 1024)
}

const formatTime = (at: number) =>
  new Date(at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Offline = {
  /** null: the cache could not be measured; undefined: still measuring. */
  kb: number | null | undefined
  queue?: { pending: number; at?: number }
  error?: string
  persistDenied: boolean
}

/** Measures the offline cache, keeps the sync queue running and asks for durable storage; read once by the app. */
export function useOffline(): Offline {
  const [kb, setKb] = useState<number | null>()
  const [queue, setQueue] = useState<{ pending: number; at?: number }>()
  const [error, setError] = useState<string>()
  const [persistDenied, setPersistDenied] = useState(false)

  useEffect(() => {
    // The worker is only active once its install has cached every precache entry.
    navigator.serviceWorker?.ready.then(precachedKB).then(setKb, () => setKb(null))
    // Without an answer the storage is not known to be durable either.
    navigator.storage?.persist?.().then((granted) => setPersistDenied(!granted), () => setPersistDenied(true))

    async function sync() {
      const [progress, stored] = await Promise.all([load<Progress>(MINIGAMES_KEY), load<SyncState>(SYNC_KEY)])
      const events = progress?.events ?? []
      let state = stored ?? { cursor: 0 }
      setQueue({ pending: pendingCount(events.length, state), at: state.at })
      try {
        state = await syncQueue(events, state, uploadToSimulation, (s) => save(SYNC_KEY, s))
        setError(undefined)
      } catch {
        // Offline is the normal case on a trip: the pending count says enough.
        setError(navigator.onLine ? 'Die Synchronisation ist fehlgeschlagen. Die Ergebnisse bleiben in der Warteschlange.' : undefined)
      }
      setQueue({ pending: pendingCount(events.length, state), at: state.at })
    }
    const run = serialized(sync, () => setError('Die offenen Ergebnisse konnten nicht gelesen werden.'))
    const onSaved = (e: Event) => (e as CustomEvent<string>).detail === MINIGAMES_KEY && run()
    run()
    addEventListener('online', run)
    addEventListener(KV_SAVED, onSaved)
    return () => {
      removeEventListener('online', run)
      removeEventListener(KV_SAVED, onSaved)
    }
  }, [])

  return { kb, queue, error, persistDenied }
}

/** The one offline sign in the header; the details are in the technical panel. */
export function OfflineBadge({ kb }: Pick<Offline, 'kb'>) {
  return (
    <p role="status" class="offline-badge">
      {kb === undefined ? (
        'Offline-Vorbereitung lädt …'
      ) : kb === null ? (
        'Der Offline-Speicher konnte nicht geprüft werden.'
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="currentColor" />
            <path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="var(--brand)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          offline bereit
        </>
      )}
    </p>
  )
}

/** Details for the evaluators, out of the children's way, the storage hint included; the summary flags it. */
export function TechPanel({ kb, queue, error, persistDenied }: Offline) {
  return (
    <section class="tech" aria-label="Technik für Prüfer">
      <details>
        <summary><span>Technik für Prüfer</span>{persistDenied && <span> · Hinweis zum Speicher</span>}</summary>
        <ul>
          <li>{kb === undefined ? 'Download für offline: wird ermittelt' : kb === null ? 'Download für offline: nicht messbar' : `Download für offline: ${kb.toLocaleString('de-DE')} kB`}</li>
          {queue && (
            <li>Offene Ergebnisse: {queue.pending}{queue.at !== undefined && ` · zuletzt synchronisiert ${formatTime(queue.at)}`}</li>
          )}
          <li>Sync-Ziel: lokale Simulation, kein Server</li>
          {persistDenied && <li>Der Speicher ist nicht dauerhaft gesichert. Installiert die App auf dem Home-Bildschirm, damit der Spielstand erhalten bleibt.</li>}
        </ul>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
