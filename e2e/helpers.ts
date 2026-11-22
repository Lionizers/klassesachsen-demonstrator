import { expect, type Page } from '@playwright/test'
import { PLACE_NAME } from '../src/minigames/burg-funkelfels'
import { DB_NAME, STORE } from '../src/store/db'

export const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

/** From the group screen to the map; the view is settled once its heading has the focus. */
export async function openMapFromGroup(page: Page) {
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await expect(page.getByRole('img', { name: /Fantasiekarte/ })).toBeVisible()
}

/** From the group screen over the map into Burg Funkelfels by its code; typing before a heading has the focus races the view change. */
export async function reachPlaceFromGroup(page: Page) {
  await openMapFromGroup(page)
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

/** Back from the place over the map to the group screen. */
export async function leaveToGroup(page: Page) {
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
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
