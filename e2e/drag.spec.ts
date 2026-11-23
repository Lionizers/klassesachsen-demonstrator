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

test('AE7: with reduced motion the pieces do not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openPuzzle(page)
  await dragOver(page, 0, pieces(page).nth(1))
  for (const li of await pieces(page).all()) {
    expect(await li.evaluate((el) => getComputedStyle(el).transitionDuration.split(',').every((d) => parseFloat(d) === 0))).toBe(true)
  }
  await page.mouse.up()
})
