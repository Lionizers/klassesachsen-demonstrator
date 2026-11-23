import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Estimate } from '../src/minigames/model'
import { DB_NAME, STORE } from '../src/store/db'

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
export const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!

export const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

/** Checks the whole page, or only the part matching `include`. */
export async function axeClean(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG)
  const result = await (include ? builder.include(include) : builder).analyze()
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

/** From the map into Burg Funkelfels by its code, ending on its stations. */
export async function reachPlaceFromMap(page: Page) {
  await checkIn(page, PLACE_NAME, 'FUNKELFELS')
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

/** From the group screen over the map into Burg Funkelfels; typing before a heading has the focus races the view change. */
export async function reachPlaceFromGroup(page: Page) {
  await openMapFromGroup(page)
  await reachPlaceFromMap(page)
}

/** A fresh device: past the welcome page to the group start, whose heading has the focus. */
export async function openStart(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Als Schulgruppe spielen (ca. 5 Minuten)' }).click()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeFocused()
}

/** A fresh device: group Otter is created and its screen has the focus. */
export async function startGroup(page: Page) {
  await openStart(page)
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
}

/** From a station result back to the stations of the place. */
export async function backToStations(page: Page) {
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()
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

/**
 * Runs `fn(stored value, arg)` inside the page, where Blobs stay Blobs; with `write` its result replaces the value.
 * `fn` travels as source text, so it must not close over test variables: hand them over as `arg`.
 */
function inStore(page: Page, key: string, fn: (value: never, arg: never) => unknown, arg: unknown, write: boolean) {
  return page.evaluate(
    async ([db, storeName, k, src, a, w]) => {
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(db)
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const get = conn.transaction(storeName).objectStore(storeName).get(k)
      const old = await new Promise((resolve, reject) => {
        get.onsuccess = () => resolve(get.result)
        get.onerror = () => reject(get.error)
      })
      const result = await (0, eval)(`(${src})`)(old, a)
      if (w) {
        await new Promise((resolve, reject) => {
          const tx = conn.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).put(result, k)
          tx.oncomplete = resolve
          tx.onerror = () => reject(tx.error)
        })
      }
      conn.close()
      return w ? undefined : result
    },
    [DB_NAME, STORE, key, fn.toString(), arg as string, write] as const,
  )
}

export const readStored = <T, R>(page: Page, key: string, fn: (value: T) => R | Promise<R>) =>
  inStore(page, key, fn as never, undefined, false) as Promise<R>

/** Call it once the app has opened its database, or the store does not exist yet. */
export const writeStored = <T, A>(page: Page, key: string, fn: (old: T | undefined, arg: A) => unknown, arg?: A) =>
  inStore(page, key, fn as never, arg, true)

/** Fetches through the service worker, which only answers once it controls the page. */
export const api = (page: Page, path: string) =>
  page.evaluate(async (p) => {
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    }
    const response = await fetch(p)
    const type = response.headers.get('Content-Type') ?? ''
    const bytes = new Uint8Array(await response.arrayBuffer())
    return {
      status: response.status,
      type,
      simulation: response.headers.get('X-Demonstrator'),
      head: Array.from(bytes.slice(0, 4)),
      json: type.startsWith('application/json') ? JSON.parse(new TextDecoder().decode(bytes)) : undefined,
    }
  }, path)
