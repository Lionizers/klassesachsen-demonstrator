import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Dilemma, Estimate, Puzzle } from '../src/minigames/model'
import { MINIGAMES_KEY, type Progress } from '../src/minigames/progress'
import { DB_NAME, STORE } from '../src/store/db'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!
const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!
const dilemma = burgFunkelfels.find((g): g is Dilemma => g.kind === 'dilemma')!

async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

async function enterPlace(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await page.getByRole('button', { name: `${PLACE_NAME} erkunden` }).click()
  await expect(page.getByRole('heading', { name: PLACE_NAME })).toBeVisible()
}

const station = (page: Page, title: string) => page.getByRole('button', { name: title })

async function solvePuzzle(page: Page) {
  const order = puzzle.pieces.map((_, i) => i)
  for (const [target, piece] of puzzle.solution.entries()) {
    for (let from = order.indexOf(piece); from > target; from--) {
      await page.getByRole('button', { name: `${puzzle.pieces[piece].standard} nach oben` }).click()
      ;[order[from - 1], order[from]] = [order[from], order[from - 1]]
    }
  }
  await page.getByRole('button', { name: 'Prüfen' }).click()
}

test('AE1: solving the puzzle grants the item and finishes the station', async ({ page }) => {
  await enterPlace(page)
  await axeClean(page)
  await station(page, puzzle.title.standard).click()
  await axeClean(page)
  await solvePuzzle(page)
  await expect(page.getByText(`Du erhältst: ${puzzle.reward.standard}`)).toBeVisible()
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()
  await expect(page.getByRole('listitem').filter({ hasText: puzzle.title.standard })).toContainText('geschafft')
  await expect(station(page, puzzle.title.standard)).toHaveCount(0)
})

test('AE2/AE3: an estimate just outside is retried, exactly on the boundary is accepted', async ({ page }) => {
  await enterPlace(page)
  await station(page, estimate.title.standard).click()
  const upper = (estimate.target * (100 + estimate.tolerancePercent)) / 100
  const input = page.getByLabel(`Eure Schätzung (${estimate.unit})`)
  await input.fill(String(upper + 1))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByRole('status')).toContainText('zu hoch')
  await axeClean(page)
  await input.fill(String(upper))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByText(`Du erhältst: ${estimate.reward.standard}`)).toBeVisible()
})

test('AE4: every role votes on the device and the result is a consequence, not a verdict', async ({ page }) => {
  await enterPlace(page)
  await station(page, dilemma.title.standard).click()
  await axeClean(page)
  const [first, second] = dilemma.options
  for (const [role, option] of [['Protokoll', first], ['Navigation', second], ['Recherche', second]] as const) {
    await expect(page.getByRole('heading', { name: new RegExp(role) })).toBeVisible()
    await page.getByRole('button', { name: option.label.standard }).click()
  }
  await expect(page.getByText(second.consequence.standard)).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/richtig|falsch/i)
  await axeClean(page)
})

test('AE5: asking Fidelius shows a hint', async ({ page }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(page.getByText(puzzle.hints[0].standard)).toBeVisible()
})

test('AE6: a skipped station can be resumed later, also after a reload', async ({ page }) => {
  await enterPlace(page)
  await expect(page.getByText('Noch nicht begonnen')).toBeVisible()
  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await expect(page.getByText('Angefangen')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: puzzle.title.standard })).toContainText('später nachholen')
  await page.reload()
  await page.getByRole('button', { name: `${PLACE_NAME} erkunden` }).click()
  await expect(page.getByText('Angefangen')).toBeVisible()
  await station(page, puzzle.title.standard).click()
  await solvePuzzle(page)
  await expect(page.getByText(`Du erhältst: ${puzzle.reward.standard}`)).toBeVisible()
})

async function readStored(page: Page, key: string) {
  return page.evaluate(
    ([db, store, k]) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(db)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction(store).objectStore(store).get(k)
          get.onsuccess = () => resolve(get.result)
          get.onerror = () => reject(get.error)
        }
      }),
    [DB_NAME, STORE, key],
  )
}

test('AE5: a hint request is stored as event E5 at group level', async ({ page }) => {
  await enterPlace(page)
  await station(page, estimate.title.standard).click()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect.poll(async () => {
    const stored = (await readStored(page, MINIGAMES_KEY)) as { events: { code: string }[] } | undefined
    return stored?.events.some((e) => e.code === 'E5')
  }).toBe(true)
})

test('stored minigame progress contains no role names after a dilemma vote', async ({ page }) => {
  await enterPlace(page)
  await station(page, dilemma.title.standard).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: dilemma.options[0].label.standard }).click()
  await expect(page.getByText(dilemma.options[0].consequence.standard)).toBeVisible()
  const stored = JSON.stringify(await readStored(page, MINIGAMES_KEY))
  expect(stored).not.toMatch(/Protokoll|Navigation|Recherche|Otter/)
})

test('saving progress fails: the place screen shows an error', async ({ page }) => {
  await page.addInitScript(`
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      const request = put.apply(this, arguments)
      const tx = this.transaction
      if (window.failPut) request.addEventListener('success', () => tx.abort())
      return request
    }
  `)
  await enterPlace(page)
  await page.evaluate(() => { (window as unknown as { failPut?: boolean }).failPut = true })
  // Opening a station already records E1 and saves.
  await station(page, estimate.title.standard).click()
  await expect(page.getByRole('alert')).toHaveText('Der Spielstand konnte nicht gespeichert werden.')
  await expect(page.getByRole('heading', { name: estimate.title.standard })).toBeVisible()
  await expect(page.getByLabel(`Eure Schätzung (${estimate.unit})`)).toBeVisible()
})

const press = async (page: Page, name: string) => {
  // locator.press focuses and presses in one step, so a pending heading focus cannot slip in between.
  await page.getByRole('button', { name, exact: true }).press('Enter')
}
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
const hintButton = 'Fuchs Fidelius um Hilfe bitten'

test('focus moves to the heading of every view inside the place', async ({ page }) => {
  await enterPlace(page)
  await press(page, puzzle.title.standard)
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
  await press(page, 'Später nachholen')
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await press(page, estimate.title.standard)
  // Each view focuses its heading one frame later; act only after that, or the step races the focus move.
  await expect(heading(page, estimate.title.standard)).toBeFocused()
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await press(page, 'Prüfen')
  await expect(heading(page, `${estimate.title.standard}: geschafft!`)).toBeFocused()
  await press(page, `Zurück zur Übersicht von ${PLACE_NAME}`)
  await expect(heading(page, PLACE_NAME)).toBeFocused()
})

test('hints are announced, capped at the number of hints, and keep the focus', async ({ page }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  // Opening a station moves focus to its heading in the next frame; wait for it before focusing the hint button.
  await expect(page.getByRole('heading', { name: puzzle.title.standard })).toBeFocused()
  await page.getByRole('button', { name: hintButton }).focus()
  for (let i = 0; i <= puzzle.hints.length; i++) await page.keyboard.press('Enter')
  await expect(page.getByText(puzzle.hints.at(-1)!.standard)).toBeVisible()
  await expect(page.getByText(puzzle.hints[0].standard).locator('..')).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('body')).not.toBeFocused()
  await expect(page.getByRole('button', { name: hintButton })).toBeFocused()
  await expect.poll(async () => {
    const stored = (await readStored(page, MINIGAMES_KEY)) as Progress
    return stored.events.filter((e) => e.code === 'E5' && e.minigameId === puzzle.id).length
  }).toBe(puzzle.hints.length)
})

test('shown hints survive skipping and reopening the station', async ({ page }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: hintButton }).click()
  await expect(page.getByText(puzzle.hints[0].standard)).toBeVisible()
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await station(page, puzzle.title.standard).click()
  await expect(page.getByText(puzzle.hints[0].standard)).toBeVisible()
})

test('puzzle: moving a piece to the edge keeps the focus, announces the position, and stops there', async ({ page }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  const pieces = page.getByRole('list', { name: 'Reihenfolge' }).getByRole('listitem')
  const second = puzzle.pieces[1].standard
  await expect(page.getByRole('heading', { name: puzzle.title.standard })).toBeFocused()
  await page.getByRole('button', { name: `${second} nach oben` }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText(`„${second}“ jetzt an Stelle 1.`)
  await expect(page.getByRole('list', { name: 'Reihenfolge' }).locator(':focus')).toHaveCount(1)
  const order = await pieces.allTextContents()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Reihenfolge' }).locator(':focus')).toHaveCount(1)
  expect(await pieces.allTextContents()).toEqual(order)
  expect(order[0]).toContain(second)
})

test('puzzle: repeated wrong attempts are announced with their number', async ({ page }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByRole('status')).toContainText('Versuch 1')
  const first = await page.getByRole('status').textContent()
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByRole('status')).toContainText('Versuch 2')
  expect(await page.getByRole('status').textContent()).not.toEqual(first)
})

test('dilemma: the next voting role is announced', async ({ page }) => {
  await enterPlace(page)
  await station(page, dilemma.title.standard).click()
  await page.getByRole('button', { name: dilemma.options[0].label.standard }).click()
  await expect(page.getByRole('heading', { name: /Navigation stimmt ab/ })).toHaveAttribute('aria-live', 'polite')
})
