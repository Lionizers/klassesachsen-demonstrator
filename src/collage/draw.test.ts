import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { burgFunkelfels } from '../minigames/burg-funkelfels'
import { drawCollage } from './draw'
import { seedOf } from './layout'

beforeEach(() => vi.stubGlobal('Path2D', class {}))
afterEach(() => vi.unstubAllGlobals())

/** Records every method the drawing calls, whatever its name. */
function recordingContext() {
  const calls: string[] = []
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, name: string) => (name in target ? target[name] : (...args: unknown[]) => void calls.push(name, ...args.map(String))),
    set: (target, name: string, value) => ((target[name] = value), true),
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

it('AE5: the collage is drawn from shapes only, never with text', () => {
  const { ctx, calls } = recordingContext()
  drawCollage(ctx, burgFunkelfels.map((g) => g.item), { arrangement: 2, size: 2, mood: 1 }, seedOf(['x']))
  expect(calls).toContain('fill')
  expect(calls).not.toContain('fillText')
  expect(calls).not.toContain('strokeText')
  expect(calls.join(' ')).not.toMatch(/Otter|Gruppe/)
})

it('AE2: the mood sets the background', () => {
  const backgrounds = [0, 1, 2].map((mood) => {
    const { ctx } = recordingContext()
    let first: unknown
    const fillRect = ctx.fillRect
    ctx.fillRect = (...args) => {
      first ??= ctx.fillStyle
      fillRect.apply(ctx, args)
    }
    drawCollage(ctx, [burgFunkelfels[0].item], { arrangement: 0, size: 1, mood }, 1)
    return first
  })
  expect(new Set(backgrounds).size).toBe(3)
})
