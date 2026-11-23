import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Estimate } from '../src/minigames/model'
import { CHARACTER_KEY } from '../src/collection/items'
import { MINIGAMES_KEY } from '../src/minigames/progress'
import { FAIL_PUT, failPut } from './fail-put'
import { leaveToGroup, readKey, reachPlaceFromGroup } from './helpers'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!
const reward = estimate.reward.standard

async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

const collectedList = (page: Page) => page.getByRole('list', { name: 'Gesammelt' }).getByRole('listitem')
const openList = (page: Page) => page.getByRole('list', { name: 'Noch offen' }).getByRole('listitem')
const toggle = (page: Page) => page.getByRole('button', { name: `${reward} tragen` })
const character = (page: Page) => page.getByRole('img', { name: /Charakter/ })

async function openCollection(page: Page) {
  await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sammlung' })).toBeFocused()
}

/** Solves the estimate station and ends on the group screen. */
async function solveEstimate(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await reachPlaceFromGroup(page)
  await page.getByRole('button', { name: estimate.title.standard }).click()
  await expect(page.getByText(`Belohnung: ${reward}`)).toBeVisible()
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()
  await leaveToGroup(page)
}

test('AE1: the reward announced at the station is the item that appears in the collection', async ({ page }) => {
  await solveEstimate(page)
  await openCollection(page)
  await expect(collectedList(page)).toHaveText([new RegExp(reward)])
  await expect(openList(page)).toHaveCount(burgFunkelfels.length - 1)
  await axeClean(page)
})

test('AE2: on a fresh start every item is open with the condition to earn it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await openCollection(page)
  await expect(page.getByText('Noch nichts gesammelt.')).toBeVisible()
  await expect(openList(page)).toHaveText(
    burgFunkelfels.map((g) => new RegExp(`${g.reward.standard}.*Station „${g.title.standard}“ bei ${PLACE_NAME} schaffen`)),
  )
  await expect(character(page)).toHaveAccessibleName('Euer Charakter trägt noch nichts.')
  await axeClean(page)
})

test('AE3: a collected item can be put on the character and taken off again', async ({ page }) => {
  await solveEstimate(page)
  await openCollection(page)
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(character(page)).toHaveAccessibleName(`Euer Charakter trägt: ${reward}`)
  await axeClean(page)
  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(character(page)).toHaveAccessibleName('Euer Charakter trägt noch nichts.')
})

test('AE4: a solved station cannot be played again and its item is listed once', async ({ page }) => {
  await solveEstimate(page)
  await reachPlaceFromGroup(page)
  await expect(page.getByRole('button', { name: estimate.title.standard })).toHaveCount(0)
  await leaveToGroup(page)
  await openCollection(page)
  await expect(collectedList(page)).toHaveCount(1)
})

test('AE5: no points, ranks or chance, and the same play gives the same collection', async ({ browser }) => {
  const texts: string[] = []
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await solveEstimate(page)
    await openCollection(page)
    const text = (await page.locator('main section').textContent()) ?? ''
    expect(text).not.toMatch(/Punkt|Platz|Rang|Zufall|Glück|Gruppen/)
    texts.push(text)
    await context.close()
  }
  expect(texts[1]).toBe(texts[0])
})

test('AE6: collection and worn items survive a reload', async ({ page }) => {
  await solveEstimate(page)
  await openCollection(page)
  await toggle(page).click()
  await expect.poll(() => readKey(page, CHARACTER_KEY)).toEqual({ worn: [estimate.id] })
  await page.reload()
  // The app reopens the last view, so the collection is already open.
  await expect(page.getByRole('heading', { name: 'Sammlung' })).toBeVisible()
  await expect(collectedList(page)).toHaveText([new RegExp(reward)])
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(character(page)).toHaveAccessibleName(`Euer Charakter trägt: ${reward}`)
})

test('AE6: a failed save is reported and the collection stays usable', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await solveEstimate(page)
  await openCollection(page)
  await failPut(page)
  await toggle(page).click()
  await expect(page.getByRole('alert')).toHaveText('Der Charakter konnte nicht gespeichert werden.')
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
  await failPut(page, false)
  await toggle(page).click()
  await expect.poll(() => readKey(page, CHARACTER_KEY)).toEqual({ worn: [estimate.id] })
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a failed load is reported instead of an empty collection', async ({ page }) => {
  await page.addInitScript(`
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (key) {
      if (key === ${JSON.stringify(MINIGAMES_KEY)}) throw new DOMException('read failed', 'UnknownError')
      return get.apply(this, arguments)
    }
  `)
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await openCollection(page)
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Sammlung konnte nicht geladen werden.')
  await expect(page.getByText('Noch nichts gesammelt.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
  await expect(page.getByRole('button', { name: 'Sammlung', exact: true })).toBeVisible()
})
