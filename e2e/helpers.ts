import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Estimate } from '../src/minigames/model'
import { DB_NAME, STORE } from '../src/store/db'

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
export const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!

export const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

export async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

/** Opens a place on the map and checks in by code; waits for the heading focus so typing is not raced. */
export async function checkIn(page: Page, name: string, code: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} – `) }).click()
  await expect(heading(page, name)).toBeFocused()
  await page.getByLabel('Code vom Schild').fill(code)
  await page.getByRole('button', { name: 'Code prüfen' }).click()
}

export async function backToMap(page: Page) {
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
}

/** From the stations of the place to the result of the estimate station. */
export async function solveEstimate(page: Page, lang: 'standard' | 'easy' = 'standard') {
  const title = estimate.title[lang]
  await page.getByRole('button', { name: title }).click()
  await expect(heading(page, title)).toBeFocused()
  await expect(page.getByText(`Belohnung: ${estimate.reward[lang]}`)).toBeVisible()
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(heading(page, `${title}: geschafft!`)).toBeFocused()
}

/** From the group screen to the map; the view is settled once its heading has the focus. */
export async function openMapFromGroup(page: Page) {
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await expect(page.getByRole('img', { name: /Fantasiekarte/ })).toBeVisible()
}

/** From the group screen over the map into Burg Funkelfels by its code; typing before a heading has the focus races the view change. */
export async function reachPlaceFromGroup(page: Page) {
  await openMapFromGroup(page)
  await checkIn(page, PLACE_NAME, 'FUNKELFELS')
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

/** Back from the place over the map to the group screen. */
export async function leaveToGroup(page: Page) {
  await backToMap(page)
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
}

/** The whole key-value store of the app, read straight from IndexedDB. */
export function dumpStore(page: Page) {
  return page.evaluate(
    ([db, storeName]) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const open = indexedDB.open(db)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const store = open.result.transaction(storeName).objectStore(storeName)
          const keys = store.getAllKeys()
          const values = store.getAll()
          values.onsuccess = () =>
            resolve(Object.fromEntries((keys.result as string[]).map((k, i) => [k, values.result[i]])))
          values.onerror = () => reject(values.error)
        }
      }),
    [DB_NAME, STORE],
  )
}

export async function readKey(page: Page, key: string): Promise<unknown> {
  return (await dumpStore(page))[key]
}
