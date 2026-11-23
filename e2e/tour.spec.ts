import { test, expect, type Page } from '@playwright/test'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import { MINIGAMES_KEY, type Progress } from '../src/minigames/progress'
import { GROUP_KEY } from '../src/group'
import { CHECKLIST_KEY } from '../src/demo/checklist'
import { FAIL_PUT, failPut } from './fail-put'
import { axeClean, dumpStore, heading, openMapFromGroup, readKey, reachPlaceFromGroup, solveEstimate } from './helpers'

const WELCOME = 'Willkommen beim Demonstrator'
const PLAY = 'Als Schulgruppe spielen (ca. 5 Minuten)'
const checklist = (page: Page) => page.getByRole('list', { name: 'Prüfliste' })
const check = (page: Page, title: string) => checklist(page).getByRole('listitem').filter({ hasText: title })
const demoHelp = (page: Page) => page.getByRole('complementary', { name: 'Demo-Hilfe' })

async function welcome(page: Page) {
  await page.goto('/')
  await expect(heading(page, WELCOME)).toBeVisible()
}

async function playAsOtter(page: Page) {
  await page.getByRole('button', { name: PLAY }).click()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeFocused()
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
}

const toWelcome = async (page: Page) => {
  await page.getByRole('button', { name: 'Rundgang' }).click()
  await expect(heading(page, WELCOME)).toBeFocused()
}

test('AE1: the first visit shows the welcome page with its purpose, the note and two ways in', async ({ page }) => {
  await welcome(page)
  await expect(page.locator('main')).toContainText('Vorschlag für die Entdecker-App')
  await expect(page.locator('main')).toContainText('Alle Inhalte sind erfunden')
  await expect(page.getByRole('button', { name: PLAY })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Als Lehrkraft ansehen' })).toBeVisible()
  await axeClean(page)
})

test('AE2: the checklist names each requirement with its tender reference and a jump', async ({ page }) => {
  await welcome(page)
  const expected = [
    ['Offline', 'LV 3.1 a'], ['Freie Reihenfolge', 'LV 4.2'], ['Minigames', 'LV 4.2'], ['Bildbeitrag', 'LV 4.4'],
    ['Barrierefreiheit', 'LV 4.5'], ['Datenschutz', 'Anlage 2'], ['Dashboard', 'LV 4.3'], ['Schnittstelle', 'LV 4.4 / 4.8'],
  ]
  const items = checklist(page).getByRole('listitem')
  await expect(items).toHaveCount(expected.length)
  for (const [i, [title, lv]] of expected.entries()) {
    await expect(items.nth(i)).toContainText(title)
    await expect(items.nth(i)).toContainText(lv)
    await expect(items.nth(i).getByRole('button', { name: /^Ansehen: / })).toBeVisible()
  }
  await check(page, 'Dashboard').getByRole('button').click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await toWelcome(page)
  await check(page, 'Barrierefreiheit').getByRole('button').click()
  await expect(page.getByLabel('Hoher Kontrast')).toBeVisible()
  await check(page, 'Minigames').getByRole('button').click()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeFocused()
})

test('AE3: experienced points are ticked and stay ticked after a reload', async ({ page, context }) => {
  await welcome(page)
  await expect(checklist(page).getByText('erlebt', { exact: true })).toHaveCount(0)
  await playAsOtter(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await context.setOffline(true)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await toWelcome(page)
  for (const title of ['Offline', 'Freie Reihenfolge', 'Minigames', 'Datenschutz', 'Dashboard']) await expect(check(page, title)).toContainText('erlebt')
  for (const title of ['Bildbeitrag', 'Barrierefreiheit', 'Schnittstelle']) await expect(check(page, title)).toContainText('noch offen')
  await page.reload()
  await expect(heading(page, WELCOME)).toBeVisible()
  for (const title of ['Offline', 'Freie Reihenfolge', 'Minigames', 'Datenschutz', 'Dashboard']) await expect(check(page, title)).toContainText('erlebt')
})

test('AE4: the place shows its code and a printable QR sheet as a demo aid', async ({ page }) => {
  await welcome(page)
  await playAsOtter(page)
  await openMapFromGroup(page)
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await expect(demoHelp(page)).toContainText('Demo-Hilfe')
  await expect(demoHelp(page)).toContainText('Demo-Code dieses Orts: FUNKELFELS')
  await demoHelp(page).getByRole('button', { name: 'QR-Blatt der Orte zeigen' }).click()
  await expect(heading(page, 'QR-Blatt der Orte')).toBeFocused()
  await expect(page.getByRole('img', { name: /^QR-Code für / })).toHaveCount(3)
  await axeClean(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('img', { name: `QR-Code für ${PLACE_NAME}` })).toBeVisible()
  await expect(page.getByRole('button')).toHaveCount(0)
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Zurück zum Ort' }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await expect(page.getByLabel('Code vom Schild')).toBeVisible()
})

test('AE5: the demo aid marks the remaining stations solved, opens the collage and is logged as a demo action', async ({ page }) => {
  await welcome(page)
  await playAsOtter(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await page.getByRole('button', { name: `Zurück zur Übersicht von ${PLACE_NAME}` }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await demoHelp(page).getByRole('button', { name: 'Restliche Stationen als gelöst markieren' }).click()
  await expect(page.getByRole('heading', { name: 'Collage', exact: true })).toBeFocused()
  await expect(page.getByRole('region', { name: 'Collage' }).getByRole('button', { name: 'Collage speichern' })).toBeVisible()
  await axeClean(page)
  const progress = (await readKey(page, MINIGAMES_KEY)) as Progress
  const demo = progress.events.filter((e) => e.code === 'D1')
  expect(demo.map((e) => e.minigameId).sort()).toEqual(burgFunkelfels.filter((g) => g.kind !== 'estimate').map((g) => g.id).sort())
  // Only the station that was played counts as played.
  expect(progress.events.filter((e) => e.code === 'E2' && e.value === 'done').map((e) => e.minigameId)).toEqual([burgFunkelfels.find((g) => g.kind === 'estimate')!.id])
})

test('AE5: the teacher sees which stations the demo aid marked', async ({ page }) => {
  await welcome(page)
  await playAsOtter(page)
  await reachPlaceFromGroup(page)
  await demoHelp(page).getByRole('button', { name: 'Restliche Stationen als gelöst markieren' }).click()
  await expect(page.getByRole('heading', { name: 'Collage', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
  await page.getByRole('button', { name: 'Otter ansehen' }).click()
  await expect(heading(page, 'Gruppenansicht Otter')).toBeFocused()
  await expect(page.locator('main')).toContainText('Per Demo-Hilfe als gelöst markiert')
  await expect(page.getByRole('list', { name: 'Indikatoren' })).toContainText('Niveaustufe: Einblick gewinnen')
})

test('AE6: restarting the demo deletes everything but the settings and shows the welcome page', async ({ page }) => {
  await welcome(page)
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByLabel('Hoher Kontrast').check()
  await playAsOtter(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await toWelcome(page)
  page.once('dialog', (d) => d.accept())
  await demoHelp(page).getByRole('button', { name: 'Demo neu starten' }).click()
  await expect(heading(page, WELCOME)).toBeFocused()
  await expect.poll(async () => Object.keys(await dumpStore(page)).sort()).toEqual(['screen', 'settings'])
  await expect(checklist(page).getByText('erlebt', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(heading(page, WELCOME)).toBeVisible()
  await expect(page.getByLabel('Hoher Kontrast')).toBeChecked()
})

test('AE6: a cancelled restart keeps the data', async ({ page }) => {
  await welcome(page)
  await playAsOtter(page)
  await toWelcome(page)
  page.once('dialog', (d) => d.dismiss())
  await demoHelp(page).getByRole('button', { name: 'Demo neu starten' }).click()
  expect(await readKey(page, GROUP_KEY)).toMatchObject({ name: 'Otter' })
})

test('AE7: the teacher way explains the second role and leads back to the welcome page', async ({ page }) => {
  await welcome(page)
  await page.getByRole('button', { name: 'Als Lehrkraft ansehen' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await expect(page.locator('main')).toContainText('zweite Rolle')
  await page.getByRole('button', { name: 'Zurück zur Willkommensseite' }).click()
  await expect(heading(page, WELCOME)).toBeFocused()
})

test('AE8: a started group reaches the welcome page by a button and keeps its game', async ({ page }) => {
  await welcome(page)
  await playAsOtter(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await toWelcome(page)
  await page.getByRole('button', { name: PLAY }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  expect(((await readKey(page, MINIGAMES_KEY)) as Progress).status).toMatchObject({ [burgFunkelfels.find((g) => g.kind === 'estimate')!.id]: 'done' })
})

test('AE9: saving the checklist fails: an alert, and the page stays usable', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await welcome(page)
  await failPut(page, CHECKLIST_KEY)
  await page.getByRole('button', { name: 'Als Lehrkraft ansehen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Die Prüfliste konnte nicht gespeichert werden.')
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeVisible()
  await page.getByRole('button', { name: 'Zurück zur Willkommensseite' }).click()
  await expect(heading(page, WELCOME)).toBeFocused()
})

test('a start code from a QR sheet skips the welcome page', async ({ page }) => {
  await page.goto('/?start=OTTER')
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
})
