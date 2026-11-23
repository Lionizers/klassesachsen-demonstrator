import { test, expect, type Page } from '@playwright/test'
import { burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Puzzle } from '../src/minigames/model'
import { axeClean, heading, reachPlaceFromGroup, startGroup } from './helpers'

const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!
const labels = puzzle.pieces.map((p) => p.standard)
const pieces = (page: Page) => page.getByRole('list', { name: 'Reihenfolge' }).getByRole('listitem')
const grip = (page: Page, i: number) => pieces(page).nth(i).locator('.grip')
const status = (page: Page) => page.locator('.play [role="status"]')

async function openPuzzle(page: Page) {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await page.getByRole('button', { name: puzzle.title.standard }).click()
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
}

const centre = async (locator: ReturnType<Page['locator']>) => {
  const b = (await locator.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Presses the mouse on the grip of piece `from` and moves it over `to`, without releasing. */
async function dragOver(page: Page, from: number, to: ReturnType<Page['locator']>) {
  const start = await centre(grip(page, from))
  const end = await centre(to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
}

test.use({ viewport: { width: 1024, height: 768 } })

test('AE1-AE3: a piece dragged by its grip onto another takes its place; marked while dragging, announced after', async ({ page }) => {
  await openPuzzle(page)
  const box = (await grip(page, 0).boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  await dragOver(page, 0, pieces(page).nth(2))
  await expect(pieces(page).nth(0)).toHaveClass(/\bdragging\b/)
  await expect(pieces(page).nth(2)).toHaveClass(/\btarget\b/)
  // Without reduced motion the marking eases in; AE7 checks that reduced motion switches it off.
  expect(await pieces(page).nth(2).evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))).toBeGreaterThan(0)
  await page.mouse.up()
  await expect(pieces(page).locator('span:not(.grip)')).toHaveText([labels[1], labels[2], labels[0], labels[3], labels[4], labels[5]])
  await expect(status(page)).toHaveText(`„${labels[0]}“ jetzt an Stelle 3.`)
  await expect(page.locator('.pieces .dragging, .pieces .target')).toHaveCount(0)
  // Upwards too: the last piece onto the first place.
  await dragOver(page, 5, pieces(page).nth(0))
  await page.mouse.up()
  await expect(pieces(page).locator('span:not(.grip)').first()).toHaveText(labels[5])
  await axeClean(page)
})

test('AE6: released outside the list or on its own place, the order stays and nothing is announced', async ({ page }) => {
  await openPuzzle(page)
  await dragOver(page, 1, heading(page, puzzle.title.standard))
  await page.mouse.up()
  await dragOver(page, 2, pieces(page).nth(2))
  await page.mouse.up()
  await expect(pieces(page).locator('span:not(.grip)')).toHaveText(labels)
  await expect(status(page)).toHaveText('')
  await expect(page.locator('.pieces .dragging, .pieces .target')).toHaveCount(0)
})

test('AE4/AE5: only the grip blocks scrolling; it is hidden from screen readers and not in the tab order', async ({ page }) => {
  await openPuzzle(page)
  await expect(grip(page, 0)).toHaveCSS('touch-action', 'none')
  await expect(pieces(page).nth(0)).not.toHaveCSS('touch-action', 'none')
  await expect(grip(page, 0)).toHaveAttribute('aria-hidden', 'true')
  expect(await grip(page, 0).evaluate((el) => el.tabIndex)).toBe(-1)
  // The arrows still move a piece with the keyboard.
  await page.getByRole('button', { name: `${labels[0]} nach unten` }).focus()
  await page.keyboard.press('Enter')
  await expect(pieces(page).locator('span:not(.grip)').nth(1)).toHaveText(labels[0])
})

test.describe('with a finger', () => {
  test.use({ hasTouch: true })

  test('AE1: a touch drag on the grip moves the piece', async ({ page }) => {
    await openPuzzle(page)
    const start = await centre(grip(page, 0))
    const end = await centre(pieces(page).nth(3))
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] })
    await touch('touchStart', start)
    for (let s = 1; s <= 8; s++) await touch('touchMove', { x: start.x + ((end.x - start.x) * s) / 8, y: start.y + ((end.y - start.y) * s) / 8 })
    await touch('touchEnd')
    await expect(pieces(page).locator('span:not(.grip)').nth(3)).toHaveText(labels[0])
  })
})

test('AE6: a right click on the grip does not drag', async ({ page }) => {
  await openPuzzle(page)
  const start = await centre(grip(page, 0))
  const end = await centre(pieces(page).nth(3))
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(end.x, end.y, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await expect(pieces(page).locator('span:not(.grip)')).toHaveText(labels)
})

test('an arrow pressed during a drag is kept, and the drop announces the dragged piece', async ({ page }) => {
  await openPuzzle(page)
  await dragOver(page, 0, pieces(page).nth(4))
  // While the mouse holds piece 0, the keyboard swaps pieces 2 and 3.
  await page.getByRole('button', { name: `${labels[2]} nach unten` }).focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()
  await expect(pieces(page).locator('span:not(.grip)')).toHaveText([labels[1], labels[3], labels[2], labels[4], labels[0], labels[5]])
  await expect(status(page)).toHaveText(`„${labels[0]}“ jetzt an Stelle 5.`)
})

test('leaving the station mid-drag removes the drag listeners', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set<unknown>()
    const add = window.addEventListener.bind(window)
    const remove = window.removeEventListener.bind(window)
    window.addEventListener = ((type: string, fn: unknown, o?: unknown) => {
      if (type === 'pointermove') live.add(fn)
      return add(type, fn as EventListener, o as AddEventListenerOptions)
    }) as typeof window.addEventListener
    window.removeEventListener = ((type: string, fn: unknown, o?: unknown) => {
      if (type === 'pointermove') live.delete(fn)
      return remove(type, fn as EventListener, o as EventListenerOptions)
    }) as typeof window.removeEventListener
    ;(window as unknown as { moveListeners: () => number }).moveListeners = () => live.size
  })
  await openPuzzle(page)
  const count = () => page.evaluate(() => (window as unknown as { moveListeners: () => number }).moveListeners())
  const before = await count()
  await dragOver(page, 0, pieces(page).nth(2))
  expect(await count()).toBe(before + 1)
  await page.getByRole('button', { name: /^Zurück zu / }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  expect(await count()).toBe(before)
  await page.mouse.up()
})

test.describe('with fingers', () => {
  test.use({ hasTouch: true })

  const session = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page)
    return (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id?: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  }

  test('another pointer lifting elsewhere neither drops nor steers the drag', async ({ page }) => {
    await openPuzzle(page)
    const touch = await session(page)
    const tap = await centre(pieces(page).nth(5))
    await dragOver(page, 0, pieces(page).nth(2))
    // A finger taps the last piece while the mouse still holds piece 0; before the fix its release dropped piece 0 there.
    await touch('touchStart', [{ ...tap, id: 2 }])
    await touch('touchEnd', [])
    await expect(pieces(page).locator('span:not(.grip)')).toHaveText(labels)
    await expect(pieces(page).nth(2)).toHaveClass(/\btarget\b/)
    await page.mouse.up()
    await expect(pieces(page).locator('span:not(.grip)')).toHaveText([labels[1], labels[2], labels[0], labels[3], labels[4], labels[5]])
  })

  test('a second grip touched during a drag does not start a second drag', async ({ page }) => {
    await openPuzzle(page)
    const touch = await session(page)
    const a = await centre(grip(page, 0))
    const b = await centre(grip(page, 4))
    await touch('touchStart', [{ ...a, id: 1 }])
    await touch('touchStart', [{ ...a, id: 1 }, { ...b, id: 2 }])
    await expect(page.locator('.pieces .dragging')).toHaveCount(1)
    await expect(pieces(page).nth(0)).toHaveClass(/\bdragging\b/)
    await touch('touchEnd', [])
  })

  test('AE6: a cancelled touch (the system takes the gesture) leaves the order and clears the marks', async ({ page }) => {
    await openPuzzle(page)
    const touch = await session(page)
    const a = await centre(grip(page, 0))
    const target = await centre(pieces(page).nth(3))
    await touch('touchStart', [{ ...a, id: 1 }])
    await touch('touchMove', [{ ...target, id: 1 }])
    await expect(pieces(page).nth(3)).toHaveClass(/\btarget\b/)
    await touch('touchCancel', [])
    await expect(page.locator('.pieces .dragging, .pieces .target')).toHaveCount(0)
    await expect(pieces(page).locator('span:not(.grip)')).toHaveText(labels)
    await expect(status(page)).toHaveText('')
  })
})

test('AE7: with reduced motion the pieces do not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openPuzzle(page)
  await dragOver(page, 0, pieces(page).nth(1))
  for (const li of await pieces(page).all()) {
    expect(await li.evaluate((el) => getComputedStyle(el).transitionDuration.split(',').every((d) => parseFloat(d) === 0))).toBe(true)
  }
  await page.mouse.up()
})
