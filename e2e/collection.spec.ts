import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Estimate } from '../src/minigames/model'
import { CHARACTER_KEY } from '../src/collection/items'
import { DB_NAME, STORE } from '../src/store/db'
import { FAIL_PUT, failPut } from './fail-put'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!
const reward = estimate.reward.standard

async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

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

const collectedList = (page: Page) => page.getByRole('list', { name: 'Gesammelt' }).getByRole('listitem')
const openList = (page: Page) => page.getByRole('list', { name: 'Noch offen' }).getByRole('listitem')
const toggle = (page: Page) => page.getByRole('button', { name: `${reward} tragen` })
const character = (page: Page) => page.getByRole('img', { name: /Charakter/ })

async function openCollection(page: Page) {
  await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sammlung' })).toBeFocused()
}

/** From the group screen over the map into Burg Funkelfels, waiting for each view to settle. */
async function enterFunkelfels(page: Page) {
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(page.getByRole('heading', { name: 'Karte der Spielregion' })).toBeFocused()
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME}`) }).click()
  await expect(page.getByRole('heading', { name: PLACE_NAME })).toBeFocused()
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
}

/** Back from the place over the map to the group screen. */
async function leaveToGroup(page: Page) {
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(page.getByRole('heading', { name: 'Karte der Spielregion' })).toBeFocused()
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
}

/** Solves the estimate station and ends on the group screen. */
async function solveEstimate(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await enterFunkelfels(page)
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
  await enterFunkelfels(page)
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
  await expect.poll(() => readStored(page, CHARACTER_KEY)).toEqual({ worn: [estimate.id] })
  await page.reload()
  await openCollection(page)
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
  await expect(toggle(page)).toBeVisible()
})
