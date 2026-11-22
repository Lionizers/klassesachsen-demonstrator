import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Dilemma, Estimate, Puzzle } from '../src/minigames/model'

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
  await page.getByRole('button', { name: 'Burg Funkelfels erkunden' }).click()
  await expect(page.getByRole('heading', { name: 'Burg Funkelfels' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Zurück zur Burg' }).click()
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
  await page.getByRole('button', { name: 'Burg Funkelfels erkunden' }).click()
  await expect(page.getByText('Angefangen')).toBeVisible()
  await station(page, puzzle.title.standard).click()
  await solvePuzzle(page)
  await expect(page.getByText(`Du erhältst: ${puzzle.reward.standard}`)).toBeVisible()
})
