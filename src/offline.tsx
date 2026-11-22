import { useEffect, useState } from 'preact/hooks'
import { load, save } from './store/db'
import { MINIGAMES_KEY, type GameEvent, type Progress } from './minigames/progress'

export const SYNC_KEY = 'sync'

/** The stored minigame events are the queue; `cursor` counts those already synced, `at` is the last sync time (E10). */
export type SyncState = { cursor: number; at?: number }

export function pendingCount(events: number, state: SyncState | undefined): number {
  return Math.max(0, events - (state?.cursor ?? 0))
}

/** Moves the cursor only after upload and save both succeeded, so a failure never drops a result from the queue. */
export async function syncQueue(
  events: GameEvent[],
  state: SyncState,
  upload: (events: GameEvent[]) => Promise<void>,
  persist: (state: SyncState) => Promise<void>,
  now: () => number = Date.now,
): Promise<SyncState> {
  if (events.length <= state.cursor) return state
  await upload(events.slice(state.cursor))
  const next = { cursor: events.length, at: now() }
  await persist(next)
  return next
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

export function OfflineStatus() {
  const [kb, setKb] = useState<number>()
  const [queue, setQueue] = useState<{ pending: number; at?: number }>()
  const [error, setError] = useState<string>()
  const [persistDenied, setPersistDenied] = useState(false)

  useEffect(() => {
    // The worker is only active once its install has cached every precache entry.
    navigator.serviceWorker?.ready.then(precachedKB).then(setKb)
    navigator.storage?.persist?.().then((granted) => setPersistDenied(!granted))

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
    // Serialized, so an older run cannot write back a smaller cursor after a newer one.
    let running = Promise.resolve()
    // A read failure means the storage is gone; the app already reports that.
    const run = () => (running = running.then(sync).catch(() => {}))
    const onSaved = (e: Event) => (e as CustomEvent<string>).detail === MINIGAMES_KEY && run()
    run()
    addEventListener('online', run)
    addEventListener('kv-saved', onSaved)
    return () => {
      removeEventListener('online', run)
      removeEventListener('kv-saved', onSaved)
    }
  }, [])

  return (
    <div class="offline-status">
      <p>{kb === undefined ? 'Offline-Vorbereitung lädt …' : `bereit für offline ✔ · ${kb.toLocaleString('de-DE')} kB`}</p>
      {queue && (
        <p>Offene Ergebnisse: {queue.pending}{queue.at !== undefined && ` · zuletzt synchronisiert ${formatTime(queue.at)}`}</p>
      )}
      <p>Sync-Ziel: lokale Simulation, kein Server</p>
      {error && <p role="alert">{error}</p>}
      {persistDenied && (
        <p>Der Speicher ist nicht dauerhaft gesichert. Installiert die App auf dem Home-Bildschirm, damit der Spielstand erhalten bleibt.</p>
      )}
    </div>
  )
}
