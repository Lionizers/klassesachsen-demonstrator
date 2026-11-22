import { describe, expect, it, vi } from 'vitest'
import type { GameEvent } from './minigames/progress'
import { pendingCount, syncQueue } from './offline'

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
