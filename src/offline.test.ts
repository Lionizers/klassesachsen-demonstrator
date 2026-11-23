import { describe, expect, it, vi } from 'vitest'
import type { GameEvent } from './minigames/progress'
import { pendingCount, serialized, syncQueue, type SyncState } from './offline'

const event = (at: number): GameEvent => ({ code: 'E1', minigameId: 'x', at, value: 'start' })
const events = [event(1), event(2), event(3)]

describe('sync queue', () => {
  it('AE4: counts the events after the cursor as pending', () => {
    expect(pendingCount(events.length, undefined)).toBe(3)
    expect(pendingCount(events.length, { cursor: 1, at: 5 })).toBe(2)
  })

  it('AE5: uploads only the events after the cursor, then moves the cursor and stamps the time', async () => {
    const upload = vi.fn(async () => {})
    const persist = vi.fn(async () => {})
    const next = await syncQueue(events, { cursor: 1, at: 5 }, upload, persist, () => 99)
    expect(upload).toHaveBeenCalledWith(events.slice(1))
    expect(next).toEqual({ cursor: 3, at: 99 })
    expect(persist).toHaveBeenCalledWith(next)
  })

  it('does not upload when nothing is pending', async () => {
    const upload = vi.fn(async () => {})
    const persist = vi.fn(async () => {})
    const state = { cursor: 3, at: 5 }
    expect(await syncQueue(events, state, upload, persist, () => 99)).toBe(state)
    expect(upload).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it('AE7: a failed upload keeps the cursor: nothing is marked as synced', async () => {
    const persist = vi.fn(async () => {})
    const upload = async () => { throw new Error('offline') }
    await expect(syncQueue(events, { cursor: 1, at: 5 }, upload, persist, () => 99)).rejects.toThrow('offline')
    expect(persist).not.toHaveBeenCalled()
  })
})

describe('sync cursor after the events shrank', () => {
  it('treats a cursor beyond the events as zero, so new events stay pending', () => {
    expect(pendingCount(2, { cursor: 3, at: 5 })).toBe(2)
  })

  it('uploads all events when the cursor is beyond them', async () => {
    const upload = vi.fn(async () => {})
    const next = await syncQueue(events.slice(0, 2), { cursor: 3, at: 5 }, upload, async () => {}, () => 99)
    expect(upload).toHaveBeenCalledWith(events.slice(0, 2))
    expect(next).toEqual({ cursor: 2, at: 99 })
  })
})

describe('serialized sync runs', () => {
  it('two overlapping syncs: the cursor never moves backwards', async () => {
    let stored: SyncState = { cursor: 0 }
    let queue = events.slice(0, 2)
    const written: number[] = []
    let release = () => {}
    const uploads: number[] = []
    // The first upload hangs until released; unserialized, the newer run would write first and the older one last.
    const upload = async (sent: GameEvent[]) => {
      uploads.push(sent.length)
      if (uploads.length === 1) await new Promise<void>((resolve) => (release = resolve))
    }
    const run = serialized(async () => {
      stored = await syncQueue(queue, stored, upload, async (s) => { written.push(s.cursor) })
    }, () => {})
    const first = run()
    await vi.waitFor(() => expect(uploads).toHaveLength(1))
    queue = events
    const second = run()
    await new Promise((resolve) => setTimeout(resolve, 10))
    release()
    await Promise.all([first, second])
    expect(written).toEqual([2, 3])
    expect(stored.cursor).toBe(3)
  })

  it('reports a failed run and still runs the next one', async () => {
    const onError = vi.fn()
    const task = vi.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce(undefined)
    const run = serialized(task, onError)
    await run()
    await run()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
