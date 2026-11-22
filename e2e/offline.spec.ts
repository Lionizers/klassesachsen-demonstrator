import { test, expect, type Page } from '@playwright/test'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Dilemma, Estimate, Puzzle } from '../src/minigames/model'
import { MINIGAMES_KEY } from '../src/minigames/progress'
import { DB_NAME, STORE } from '../src/store/db'

const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!
const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!
const dilemma = burgFunkelfels.find((g): g is Dilemma => g.kind === 'dilemma')!

const ready = (page: Page) => page.getByText(/^bereit für offline ✔ · [\d.]+ kB$/)
const queue = (page: Page) => page.getByText(/^Offene Ergebnisse:/)
const SYNCED = /^Offene Ergebnisse: 0 · zuletzt synchronisiert \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/
const station = (page: Page, title: string) => page.getByRole('button', { name: title })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

/** From the group screen over the map to the stations; waits for the heading focus so typing is not raced by the view change. */
async function reachPlace(page: Page) {
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await expect(page.getByRole('img', { name: /Fantasiekarte/ })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

async function enterPlace(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await reachPlace(page)
}

/** Makes saving the given key fail by aborting its transaction, like a full quota would. */
const FAIL_KEY = `
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (value, key) {
    const request = put.apply(this, arguments)
    const tx = this.transaction
    if (window.failKey === key) request.addEventListener('success', () => tx.abort())
    return request
  }
`

test('AE1: the header says ready for offline with the download size once everything is cached', async ({ page }) => {
  await page.goto('/')
  await expect(ready(page)).toBeVisible()
  const kb = Number((await ready(page).textContent())!.match(/([\d.]+) kB/)![1].replace('.', ''))
  expect(kb).toBeGreaterThan(0)
  await expect(page.getByText('Sync-Ziel: lokale Simulation, kein Server')).toBeVisible()
})

test.describe('without a service worker', () => {
  test.use({ serviceWorkers: 'block' })

  test('AE1: the header keeps saying it is loading, never ready', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Offline-Vorbereitung lädt …')).toBeVisible()
    // Caching takes well under a second on localhost; a ready claim would show up by then.
    await page.waitForTimeout(1000)
    await expect(ready(page)).toHaveCount(0)
  })
})

test('AE2/AE4/AE5: offline the map and all three minigames work, results queue up and sync when back online', async ({ page, context }) => {
  await page.goto('/')
  await expect(ready(page)).toBeVisible()
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
  // The first load is not controlled yet; a second load is served through the worker.
  await page.reload()
  await context.setOffline(true)
  await page.reload()

  await reachPlace(page)

  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(page.getByText(puzzle.hints[0].standard)).toBeVisible()
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByRole('status')).toContainText('Versuch 1')
  await page.getByRole('button', { name: 'Später nachholen' }).click()

  await station(page, estimate.title.standard).click()
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(page.getByText(`Du erhältst: ${estimate.reward.standard}`)).toBeVisible()
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()

  await station(page, dilemma.title.standard).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: dilemma.options[0].label.standard }).click()
  await expect(page.getByText(dilemma.options[0].consequence.standard)).toBeVisible()

  await expect(queue(page)).toHaveText(/^Offene Ergebnisse: [1-9]\d*$/)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await context.setOffline(false)
  await expect(queue(page)).toHaveText(SYNCED)
})

test('AE3: after closing and reopening the tab the group is back on the same view with its progress', async ({ page, context }) => {
  await enterPlace(page)
  await station(page, puzzle.title.standard).click()
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await expect(page.getByText('Angefangen')).toBeVisible()
  // The save starts on the tap; a test closes the tab within milliseconds, so wait for it to land first.
  await expect.poll(() => page.evaluate(([db, store, key, id]) => new Promise((resolve) => {
    indexedDB.open(db).onsuccess = (e) => {
      const get = (e.target as IDBOpenDBRequest).result.transaction(store).objectStore(store).get(key)
      get.onsuccess = () => resolve(get.result?.status[id])
    }
  }), [DB_NAME, STORE, MINIGAMES_KEY, puzzle.id])).toBe('skipped')
  await page.close()

  const again = await context.newPage()
  await again.goto('/')
  await expect(again.getByRole('heading', { name: PLACE_NAME })).toBeVisible()
  await expect(again.getByText('Angefangen')).toBeVisible()
  await expect(again.getByRole('listitem').filter({ hasText: puzzle.title.standard })).toContainText('später nachholen')
})

test('AE3: a reopened place the group has not reached yet still asks for its check', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await expect.poll(() => page.evaluate(([db, store]) => new Promise((resolve) => {
    indexedDB.open(db).onsuccess = (e) => {
      const get = (e.target as IDBOpenDBRequest).result.transaction(store).objectStore(store).get('place')
      get.onsuccess = () => resolve(get.result)
    }
  }), [DB_NAME, STORE])).toBe('funkelfels')
  await page.reload()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await expect(page.getByLabel('Code vom Schild')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Stationen' })).toHaveCount(0)
})

test('AE6: storage persistence refused: the header asks to install the app on the home screen', async ({ page }) => {
  await page.addInitScript(() => { StorageManager.prototype.persist = async () => false })
  await page.goto('/')
  await expect(page.getByText(/Installiert die App auf dem Home-Bildschirm/)).toBeVisible()
})

test('AE6: storage persistence granted: no install hint', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { persistCalls: number }).persistCalls = 0
    StorageManager.prototype.persist = async () => {
      ;(window as unknown as { persistCalls: number }).persistCalls++
      return true
    }
  })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(1)
  await expect(page.getByText(/Home-Bildschirm/)).toHaveCount(0)
})

test('AE7: a failed sync keeps the results queued and says so; the next sync empties the queue', async ({ page, context }) => {
  await page.addInitScript(FAIL_KEY)
  await enterPlace(page)
  await page.evaluate(() => { (window as unknown as { failKey?: string }).failKey = 'sync' })
  // Opening a station records E1, which saves the progress and starts a sync.
  await station(page, estimate.title.standard).click()
  await expect(page.getByRole('alert')).toHaveText('Die Synchronisation ist fehlgeschlagen. Die Ergebnisse bleiben in der Warteschlange.')
  await expect(queue(page)).toHaveText('Offene Ergebnisse: 1')

  await page.evaluate(() => { (window as unknown as { failKey?: string }).failKey = undefined })
  await context.setOffline(true)
  await context.setOffline(false)
  await expect(queue(page)).toHaveText(SYNCED)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('AE3: a stored screen this version does not know falls back to the group view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
  await page.evaluate(([db, store]) => new Promise((resolve) => {
    indexedDB.open(db).onsuccess = (e) => {
      const tx = (e.target as IDBOpenDBRequest).result.transaction(store, 'readwrite')
      tx.objectStore(store).put('removed-screen', 'screen')
      tx.oncomplete = resolve
    }
  }), [DB_NAME, STORE])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
})
