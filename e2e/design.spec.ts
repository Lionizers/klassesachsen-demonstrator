import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Puzzle } from '../src/minigames/model'
import { axeClean, backToMap, checkIn, estimate, heading, leaveToGroup, openMapFromGroup, reachPlaceFromGroup, solveEstimate } from './helpers'

const IPAD = { width: 1024, height: 768 }
const PHONE = { width: 360, height: 640 }
const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!

const header = (page: Page) => page.getByRole('banner')
const tech = (page: Page) => page.getByRole('region', { name: 'Technik für Prüfer' })
const fidelius = (page: Page) => page.locator('.fidelius').filter({ has: page.getByRole('img', { name: 'Fuchs Fidelius' }) })

async function startGroup(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
}

const backToStations = async (page: Page) => {
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

test.describe('on an iPad in landscape', () => {
  test.use({ viewport: IPAD })

  test('AE1: the header takes at most 15 % of the height and holds title, offline symbol and the menu', async ({ page }) => {
    await page.goto('/')
    await expect(header(page).getByRole('heading', { level: 1 })).toBeVisible()
    await expect(header(page).getByRole('status').filter({ hasText: /^offline bereit$/ })).toBeVisible()
    const menu = header(page).getByRole('navigation', { name: 'Menü' })
    await expect(menu.getByRole('button', { name: 'Vorlesen', exact: true })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Einstellungen' })).toHaveAttribute('aria-expanded', 'false')
    await expect(menu.getByRole('button', { name: 'Lehrkräfte-Ansicht' })).toBeVisible()
    for (const detail of [/kB/, /Sync-Ziel/, /Offene Ergebnisse/]) await expect(header(page)).not.toContainText(detail)
    expect((await header(page).boundingBox())!.height).toBeLessThanOrEqual(IPAD.height * 0.15)
  })

  test('AE4: places and stations are big tiles with symbol and status; the item count is visible', async ({ page }) => {
    await startGroup(page)
    await openMapFromGroup(page)
    const places = page.getByRole('list', { name: 'Orte' }).getByRole('listitem')
    await expect(places).toHaveCount(3)
    for (const place of await places.all()) {
      await expect(place.locator('svg')).toHaveCount(1)
      await expect(place).toContainText(/offen$/)
      const box = (await place.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(72)
      expect(box.width).toBeGreaterThanOrEqual(200)
    }
    await checkIn(page, PLACE_NAME, 'FUNKELFELS')
    await expect(heading(page, PLACE_NAME)).toBeFocused()
    await expect(page.getByText('0 von 3 Items', { exact: true })).toBeVisible()
    const stations = page.getByRole('list', { name: 'Stationen' }).getByRole('listitem')
    await expect(stations).toHaveCount(3)
    for (const station of await stations.all()) {
      await expect(station.locator('svg')).toHaveCount(1)
      await expect(station).toContainText(/offen$/)
      expect((await station.boundingBox())!.height).toBeGreaterThanOrEqual(72)
    }
    await solveEstimate(page)
    await expect(page.getByText('1 von 3 Items', { exact: true })).toBeVisible()
    await backToStations(page)
    await expect(page.getByText('1 von 3 Items', { exact: true })).toBeVisible()
    await expect(stations.filter({ hasText: estimate.title.standard })).toContainText(/geschafft$/)
    await backToMap(page)
    await expect(page.getByRole('list', { name: 'Orte' }).getByRole('listitem').first()).toContainText(/angefangen$/)
    await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
    await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
    await expect(heading(page, 'Sammlung')).toBeFocused()
    await expect(page.getByText('1 von 3 Items', { exact: true })).toBeVisible()
  })
})

test('AE2: download size, sync target and queue sit in "Technik für Prüfer"', async ({ page }) => {
  await page.goto('/')
  await expect(tech(page).getByText(/^Download für offline: [\d.]+ kB$/)).toBeHidden()
  await tech(page).getByText('Technik für Prüfer', { exact: true }).click()
  await expect(tech(page).getByText(/^Download für offline: [\d.]+ kB$/)).toBeVisible()
  await expect(tech(page).getByText('Sync-Ziel: lokale Simulation, kein Server')).toBeVisible()
  await expect(tech(page).getByText(/^Offene Ergebnisse: 0/)).toBeVisible()
  await axeClean(page)
})

test('AE2: the storage hint stays visible and in a live region while the technical details are closed', async ({ page }) => {
  await page.addInitScript(() => { StorageManager.prototype.persist = async () => false })
  await page.goto('/')
  await expect(tech(page).getByRole('status').filter({ hasText: /Installiert die App auf dem Home-Bildschirm/ })).toBeVisible()
  await expect(tech(page).locator('details')).not.toHaveAttribute('open')
})

test('AE3: Fidelius greets as a figure with a speech bubble and gives the hints in it', async ({ page }) => {
  await page.goto('/')
  await expect(fidelius(page)).toBeVisible()
  await expect(fidelius(page)).toContainText('Ich bin Fuchs Fidelius')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await reachPlaceFromGroup(page)
  await expect(fidelius(page)).toContainText('Wählt eine Station')
  await page.getByRole('button', { name: puzzle.title.standard }).click()
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(fidelius(page)).toContainText(puzzle.hints[0].standard)
})

/** Name and duration in ms of the running animation of every element matching `selector`. */
const animations = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => els.map((el) => {
    const style = getComputedStyle(el)
    return { name: style.animationName, ms: parseFloat(style.animationDuration) * 1000 }
  }))

test('AE5: an earned item gets a big picture with a burst; slow tempo doubles it', async ({ page }) => {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  const moment = page.locator('.earned')
  // Measured once it has popped up: the animation starts small.
  await moment.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  expect((await moment.locator('svg.item').boundingBox())!.width).toBeGreaterThanOrEqual(96)
  const normal = await animations(page, '.earned, .earned .burst')
  expect(normal).toHaveLength(2)
  for (const a of normal) expect(a.name).not.toBe('none')
  await page.getByText('Einstellungen', { exact: true }).click()
  await page.getByLabel('Spieltempo').selectOption('slow')
  await expect.poll(async () => (await animations(page, '.earned, .earned .burst')).map((a) => a.ms)).toEqual(normal.map((a) => a.ms * 2))
})

test('AE5: reduced motion switches the burst off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await expect(page.locator('.earned .burst')).toHaveCount(1)
  expect((await animations(page, '.earned, .earned .burst')).map((a) => a.name)).toEqual(['none', 'none'])
})

test('AE6: high contrast gives 7:1 on the open menu, the technical details and the teacher view', async ({ page }) => {
  const enhanced = async (view: string) => {
    const result = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze()
    expect(result.violations, view).toEqual([])
    expect(result.incomplete, view).toEqual([])
  }
  await page.goto('/')
  await page.getByText('Einstellungen', { exact: true }).click()
  await page.getByLabel('Hoher Kontrast').check()
  await tech(page).getByText('Technik für Prüfer', { exact: true }).click()
  await enhanced('start with settings and technical details')
  await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await enhanced('teacher')
})

test.describe('on a phone', () => {
  test.use({ viewport: PHONE })

  test('AE7: no view scrolls sideways', async ({ page }) => {
    const fits = async (view: string) => {
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      expect(scroll, view).toBeLessThanOrEqual(width)
    }
    await page.goto('/')
    await fits('start')
    const settings = page.getByRole('button', { name: 'Einstellungen' })
    await settings.click()
    await fits('settings')
    await settings.click()
    await page.getByText('Technik für Prüfer', { exact: true }).click()
    await fits('technical details')
    await page.getByRole('button', { name: 'Gruppe Otter' }).click()
    await expect(heading(page, 'Gruppe Otter')).toBeFocused()
    await fits('group')
    await openMapFromGroup(page)
    await fits('map')
    await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
    await expect(heading(page, PLACE_NAME)).toBeFocused()
    await fits('place check')
    await backToMap(page)
    await reachPlaceFromGroupFromMap(page)
    await fits('stations')
    await page.getByRole('button', { name: puzzle.title.standard }).click()
    await expect(heading(page, puzzle.title.standard)).toBeFocused()
    await fits('puzzle')
    await page.getByRole('button', { name: 'Später nachholen' }).click()
    await expect(heading(page, PLACE_NAME)).toBeFocused()
    await solveEstimate(page)
    await fits('result')
    await backToStations(page)
    await leaveToGroup(page)
    await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
    await expect(heading(page, 'Sammlung')).toBeFocused()
    await fits('collection')
    await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
    await fits('teacher')
    await page.getByRole('button', { name: 'Beispiel Ahorn ansehen' }).click()
    await page.getByRole('button', { name: 'Kompetenzraster' }).click()
    await expect(heading(page, 'Kompetenzraster Beispiel Ahorn')).toBeFocused()
    await fits('raster')
  })
})

async function reachPlaceFromGroupFromMap(page: Page) {
  await checkIn(page, PLACE_NAME, 'FUNKELFELS')
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}
