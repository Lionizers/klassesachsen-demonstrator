import { test, expect, type Page } from '@playwright/test'
import jsQR from 'jsqr'
import { GROUP_KEY } from '../src/group'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import { MINIGAMES_KEY, initialProgress, reduceProgress, type Progress, type ProgressAction } from '../src/minigames/progress'
import { CONTRIBUTIONS_KEY, type Contribution } from '../src/collage/layout'
import { LEVELS } from '../src/teacher/report'
import { api, axeClean, dumpStore, heading, readKey, readStored, reachPlaceFromGroup, writeStored } from './helpers'
import { FAIL_PUT, failPut } from './fail-put'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 23, 9)
const DEMO = 'Beispielgruppe – erfundene Daten'
const RANKING = /\b(Platz|Rang\w*|beste[nrs]?)\b/i

/** Every teacher view: accessible, no free text field, no ranking. */
async function checkView(page: Page) {
  await expect(page.locator('main').getByRole('textbox')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(RANKING)
  await axeClean(page)
}

async function openTeacher(page: Page) {
  await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
}

async function startGroup(page: Page, name = 'Otter') {
  await page.goto('/')
  await page.getByRole('button', { name: `Gruppe ${name}` }).click()
  await expect(heading(page, `Gruppe ${name}`)).toBeFocused()
}

const pickClass = async (page: Page, ...names: string[]) => {
  for (const name of names) await page.getByRole('group', { name: 'Gruppen der Klasse' }).getByRole('checkbox', { name, exact: true }).check()
}
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Gruppen' }).getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })

async function openGroup(page: Page, name: string) {
  await page.getByRole('button', { name: `${name} ansehen` }).click()
  await expect(heading(page, `Gruppenansicht ${name}`)).toBeFocused()
}

const [puzzle, estimate, dilemma] = burgFunkelfels.map((g) => g.id)
/** All three stations at the first attempt without hints, the last one finished at `end`. */
const finishedAt = (end: number): Progress =>
  ([
    { type: 'open', id: puzzle, at: end - 30 * 60_000 },
    { type: 'attempt', id: puzzle, correct: true, at: end - 20 * 60_000 },
    { type: 'open', id: estimate, at: end - 20 * 60_000 },
    { type: 'attempt', id: estimate, correct: true, at: end - 10 * 60_000 },
    { type: 'open', id: dilemma, at: end - 10 * 60_000 },
    ...[1, 2, 3].map((position) => ({ type: 'vote', id: dilemma, position, at: end - 5 * 60_000 }) as ProgressAction),
    { type: 'decide', id: dilemma, option: 0, at: end },
  ] as ProgressAction[]).reduce(reduceProgress, initialProgress(burgFunkelfels))

test('AE1: chosen groups get a start code and a QR code that starts the group', async ({ page }) => {
  await page.goto('/')
  await openTeacher(page)
  await expect(page.locator('main')).toContainText('ohne Anmeldung und ohne PIN')
  await pickClass(page, 'Otter', 'Moosgrün')
  await expect.poll(() => readKey(page, 'class')).toEqual({ names: ['Otter', 'Moosgrün'] })
  await page.getByRole('button', { name: 'Startcodes drucken' }).click()
  await expect(heading(page, 'Startcodes')).toBeFocused()
  await expect(page.getByText('Startcode: OTTER')).toBeVisible()
  await expect(page.getByText('Startcode: MOOSGRÜN')).toBeVisible()
  const qr = page.getByRole('img', { name: 'QR-Code für Gruppe Otter' })
  await expect(qr).toHaveJSProperty('complete', true)
  const pixels = await qr.evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return { width: canvas.width, height: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) }
  })
  const url = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data
  expect(url).toBe(new URL('/?start=OTTER', page.url()).href)
  await checkView(page)

  await page.goto(url!)
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  expect(await readKey(page, GROUP_KEY)).toEqual({ name: 'Otter', round: 0, createdAt: expect.any(Number) })
})

test('AE1: a start code can be typed in, an unknown one is refused visibly', async ({ page }) => {
  await page.goto('/?start=HAMSTER')
  await expect(page.getByRole('alert')).toHaveText('Diesen Startcode gibt es nicht. Bitte prüft die Schreibweise.')
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeVisible()
  expect(await readKey(page, GROUP_KEY)).toBeUndefined()
  await page.getByLabel('Startcode').fill('moosgrün')
  await page.getByRole('button', { name: 'Mit Startcode starten' }).click()
  await expect(heading(page, 'Gruppe Moosgrün')).toBeFocused()
})

test('AE2/AE10: the overview lists every group alphabetically with station and status, without levels or ranking', async ({ page }) => {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await page.getByRole('button', { name: burgFunkelfels[0].title.standard }).click()
  await expect.poll(() => readKey(page, MINIGAMES_KEY)).toBeTruthy()
  await openTeacher(page)
  await pickClass(page, 'Igel', 'Otter')
  const names = page.getByRole('list', { name: 'Gruppen' }).getByRole('listitem').locator('strong')
  await expect(names).toHaveText(['Beispiel Ahorn', 'Beispiel Birke', 'Beispiel Eiche', 'Igel', 'Otter'])
  await expect(row(page, 'Otter')).toContainText(`Station: ${burgFunkelfels[0].title.standard}`)
  await expect(row(page, 'Otter')).toContainText('Status: unterwegs')
  await expect(row(page, 'Igel')).toContainText('keine Daten auf diesem Gerät')
  await expect(row(page, 'Igel').getByRole('button')).toHaveCount(0)
  await expect(row(page, 'Beispiel Ahorn')).toContainText(DEMO)
  await expect(row(page, 'Beispiel Ahorn')).toContainText('Status: Quest abgeschlossen')
  for (const level of LEVELS) await expect(page.locator('main')).not.toContainText(level)
  await checkView(page)
})

test('AE3/AE4: group view and competence grid show the three indicators, marked as example rule', async ({ page }) => {
  await startGroup(page)
  await writeStored(page, MINIGAMES_KEY, (_, value) => value, finishedAt(NOW))
  await openTeacher(page)
  await openGroup(page, 'Otter')
  const indicators = page.getByRole('list', { name: 'Indikatoren' }).getByRole('listitem')
  await expect(indicators.getByRole('heading')).toHaveText(['Teamleistung', 'Problemlösung', 'Beteiligung'])
  await expect(indicators).toHaveText([/Niveaustufe: Gestalten/, /Niveaustufe: Gestalten/, /Niveaustufe: Gestalten/])
  await expect(indicators.filter({ hasText: 'Beispielregel' })).toHaveCount(3)
  await checkView(page)

  await page.getByRole('button', { name: 'Kompetenzraster' }).click()
  await expect(heading(page, 'Kompetenzraster Otter')).toBeFocused()
  const table = page.getByRole('table', { name: /Kompetenzraster der Gruppe Otter/ })
  await expect(table).toContainText('Beispielregel')
  await expect(table.getByRole('columnheader')).toHaveText(['Indikator', ...LEVELS])
  await expect(table.getByRole('rowheader')).toHaveText(['Teamleistung', 'Problemlösung', 'Beteiligung'])
  const reached = table.getByRole('cell').filter({ hasText: 'erreicht' })
  await expect(reached).toHaveCount(3)
  for (const cell of await reached.all()) expect((await cell.textContent())!.length).toBeGreaterThan(40)
  await checkView(page)
})

test('AE3: a demo group is labelled as invented and has no delete or image functions', async ({ page }) => {
  await page.goto('/')
  await openTeacher(page)
  await openGroup(page, 'Beispiel Eiche')
  await expect(page.locator('main')).toContainText(DEMO)
  await expect(page.getByRole('button', { name: /löschen/ })).toHaveCount(0)
  await checkView(page)
})

test('AE5: the printed report holds levels, descriptions, date and quest, but no grade and no points', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printed: boolean }).printed = true } })
  await page.goto('/')
  await openTeacher(page)
  await openGroup(page, 'Beispiel Ahorn')
  await page.getByRole('button', { name: 'Bericht' }).click()
  await expect(heading(page, 'Bericht Beispiel Ahorn')).toBeFocused()
  await checkView(page)
  await page.getByRole('button', { name: 'Drucken oder als PDF speichern' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed?: boolean }).printed)).toBe(true)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.locator('.site-header')).toBeHidden()
  const text = await page.locator('body').innerText()
  expect(text).toContain('Datum: 23.11.2026')
  expect(text).toContain('Quest: Burg Funkelfels')
  expect(text).toContain(DEMO)
  expect(text).toContain('Beispielregel')
  for (const name of ['Teamleistung', 'Problemlösung', 'Beteiligung']) expect(text).toContain(name)
  expect(text).toMatch(new RegExp(LEVELS.map((l) => l.replace('/', '\\/')).join('|')))
  expect(text).not.toMatch(/\bNote\b|Punkte|\d+ ?\/ ?\d+/)
})

test('AE6: only the released picture reaches the interface', async ({ page }) => {
  await startGroup(page)
  await writeStored(page, CONTRIBUTIONS_KEY, () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const make = (id: string) => ({ id, createdAt: '2026-11-23T09:00:00.000Z', type: 'item-collage', items: ['turmuhr'], released: false, png, preview: png })
    return [make('00000000-0000-4000-8000-00000000000a'), make('00000000-0000-4000-8000-00000000000b')]
  })
  await openTeacher(page)
  await openGroup(page, 'Otter')
  const first = page.getByRole('group', { name: 'Beitrag 1' })
  const second = page.getByRole('group', { name: 'Beitrag 2' })
  // Undecided is neither released nor refused.
  await expect(second.getByRole('button', { pressed: true })).toHaveCount(0)
  await first.getByRole('button', { name: 'Freigeben' }).click()
  await second.getByRole('button', { name: 'Verweigern' }).click()
  await expect(first.getByRole('button', { name: 'Freigeben' })).toHaveAttribute('aria-pressed', 'true')
  await expect(first.getByRole('button', { name: 'Verweigern' })).toHaveAttribute('aria-pressed', 'false')
  await expect(second.getByRole('button', { name: 'Verweigern' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => readStored(page, CONTRIBUTIONS_KEY, (l: Contribution[]) => l.map((c) => c.released))).toEqual([true, false])
  expect((await api(page, '/api/beitraege')).json).toEqual([expect.objectContaining({ id: '00000000-0000-4000-8000-00000000000a' })])
  await checkView(page)
})

test('AE7: deleting removes every group key at once, only class and settings stay', async ({ page }) => {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await page.getByRole('button', { name: burgFunkelfels[0].title.standard }).click()
  await expect.poll(() => readKey(page, MINIGAMES_KEY)).toBeTruthy()
  await writeStored(page, CONTRIBUTIONS_KEY, () => [])
  // A key this version does not know yet must not survive the deletion either.
  await writeStored(page, 'future-key', () => 'group data')
  await openTeacher(page)
  await pickClass(page, 'Otter')
  await openGroup(page, 'Otter')
  expect(Object.keys(await dumpStore(page)).length).toBeGreaterThan(5)

  // Playwright dismisses the confirmation by default: nothing may be deleted then.
  await page.getByRole('button', { name: 'Daten der Gruppe löschen' }).click()
  expect(await readKey(page, GROUP_KEY)).toBeDefined()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Daten der Gruppe löschen' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: 'Die Daten der Gruppe Otter sind gelöscht.' })).toBeVisible()
  expect(Object.keys(await dumpStore(page)).filter((k) => !['class', 'settings'].includes(k))).toEqual([])
  await expect(row(page, 'Otter')).toContainText('keine Daten auf diesem Gerät')
  await checkView(page)
  await page.getByRole('button', { name: 'Zurück zur App' }).click()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeFocused()
})

for (const [label, age, kept] of [['kept', 84 * DAY, true], ['deleted', 84 * DAY + 1, false]] as const) {
  test(`AE8: group data 12 weeks ${kept ? '' : 'and 1 ms '}after quest completion is ${label} on start`, async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await startGroup(page)
    await writeStored(page, MINIGAMES_KEY, (_, value) => value, finishedAt(NOW - age))
    await page.reload()
    await expect(heading(page, kept ? 'Gruppe Otter' : 'Wie heißt eure Gruppe?')).toBeVisible()
    expect(await readKey(page, MINIGAMES_KEY)).toEqual(kept ? expect.anything() : undefined)
  })
}

test('AE8: a failed retention check is reported and the group can still play', async ({ page }) => {
  await page.addInitScript(`
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (key) {
      if (key === ${JSON.stringify(MINIGAMES_KEY)}) throw new DOMException('read failed', 'UnknownError')
      return get.apply(this, arguments)
    }
  `)
  await startGroup(page)
  await expect(page.locator('.site-header').getByText('Abgelaufene Gruppendaten konnten nicht gelöscht werden.')).toHaveRole('alert')
})

const at = (berlin: string) => Date.parse(`${berlin}+02:00`)

test('AE8: an unfinished quest is kept 12 weeks after its last activity and deleted 1 ms later', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await page.getByRole('button', { name: burgFunkelfels[0].title.standard }).click()
  await expect.poll(() => readKey(page, MINIGAMES_KEY)).toBeTruthy()
  await page.clock.setFixedTime(NOW + 84 * DAY)
  await page.reload()
  await expect(heading(page, PLACE_NAME)).toBeVisible()
  await page.clock.setFixedTime(NOW + 84 * DAY + 1)
  await page.reload()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeVisible()
  expect(Object.keys(await dumpStore(page)).filter((k) => !['class', 'settings', 'screen'].includes(k))).toEqual([])
})

test('AE8: all group data is deleted at the end of the school year, from 1 August 00:00', async ({ page }) => {
  await page.clock.setFixedTime(at('2027-07-01T09:00'))
  await startGroup(page)
  await page.clock.setFixedTime(at('2027-07-31T23:59:59.999'))
  await page.reload()
  await expect(heading(page, 'Gruppe Otter')).toBeVisible()
  await page.clock.setFixedTime(at('2027-08-01T00:00'))
  await page.reload()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeVisible()
  expect(await readKey(page, GROUP_KEY)).toBeUndefined()
})

test('a start code on a device that already has a group is reported as not used and removed from the address', async ({ page }) => {
  await startGroup(page)
  await page.goto('/?start=IGEL')
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Auf diesem Gerät spielt schon die Gruppe Otter. Der Startcode IGEL wurde nicht verwendet.')
  await expect(heading(page, 'Gruppe Otter')).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  expect(await readKey(page, GROUP_KEY)).toMatchObject({ name: 'Otter' })
})

test('after deleting a group started by QR code, its start code does not start it again', async ({ page }) => {
  await page.goto('/?start=OTTER')
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  expect(new URL(page.url()).search).toBe('')
  await openTeacher(page)
  await openGroup(page, 'Otter')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Daten der Gruppe löschen' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await page.getByRole('button', { name: 'Zurück zur App' }).click()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeFocused()
  await page.reload()
  await expect(heading(page, 'Wie heißt eure Gruppe?')).toBeVisible()
  expect(await readKey(page, GROUP_KEY)).toBeUndefined()
})

test('the start code hint and error follow easy language, the error sits above the content', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Einstellungen', { exact: true }).click()
  await page.getByLabel('Einfache Sprache').check()
  await expect(page.getByText('Der Code steht auf eurem Zettel.')).toBeVisible()
  await page.getByLabel('Startcode').fill('hamster')
  await page.getByRole('button', { name: 'Mit Startcode starten' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Diesen Code gibt es nicht. Schaut noch einmal auf euren Zettel.')
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0)
})

test('a real group named like a demo group stays apart from it', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Eigener Gruppenname').fill('Ahorn')
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click()
  await expect(heading(page, 'Gruppe Ahorn')).toBeFocused()
  await openTeacher(page)
  await page.getByRole('button', { name: 'Ahorn ansehen', exact: true }).click()
  await expect(heading(page, 'Gruppenansicht Ahorn')).toBeFocused()
  await expect(page.locator('main')).not.toContainText(DEMO)
})

test('deleting a group also empties the offline counter of open results', async ({ page, context }) => {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: burgFunkelfels[0].title.standard }).click()
  const queue = page.getByText(/^Offene Ergebnisse:/)
  await expect(queue).toHaveText('Offene Ergebnisse: 1')
  await openTeacher(page)
  await openGroup(page, 'Otter')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Daten der Gruppe löschen' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await expect(queue).toHaveText('Offene Ergebnisse: 0')
})

test('loading fails: the teacher view says so and still leads back to the app, also after a reload', async ({ page }) => {
  await page.addInitScript(`
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (key) {
      if (key === 'class') throw new DOMException('read failed', 'UnknownError')
      return get.apply(this, arguments)
    }
  `)
  await startGroup(page)
  await openTeacher(page)
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Daten dieses Geräts konnten nicht geladen werden.')
  await page.reload()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Daten dieses Geräts konnten nicht geladen werden.')
  await page.getByRole('button', { name: 'Zurück zur App' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
})

test('saving the class list fails: an error is shown and the choice is taken back', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await page.goto('/')
  await openTeacher(page)
  await failPut(page, 'class')
  const otter = page.getByRole('group', { name: 'Gruppen der Klasse' }).getByRole('checkbox', { name: 'Otter', exact: true })
  await otter.click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Gruppen der Klasse konnten nicht gespeichert werden.')
  await expect(otter).not.toBeChecked()
  expect(await readKey(page, 'class')).toBeUndefined()
})

test('saving a release fails: an error is shown and the picture stays undecided', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await startGroup(page)
  await writeStored(page, CONTRIBUTIONS_KEY, () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    return [{ id: '00000000-0000-4000-8000-00000000000a', createdAt: '2026-11-23T09:00:00.000Z', type: 'item-collage', items: ['turmuhr'], released: false, png, preview: png }]
  })
  await openTeacher(page)
  await openGroup(page, 'Otter')
  await failPut(page, CONTRIBUTIONS_KEY)
  await page.getByRole('button', { name: 'Freigeben' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Freigabe konnte nicht gespeichert werden.')
  await expect(page.getByRole('button', { name: 'Freigeben' })).toHaveAttribute('aria-pressed', 'false')
  expect(await readStored(page, CONTRIBUTIONS_KEY, (l: Contribution[]) => l.map((c) => c.released))).toEqual([false])
})

test('deleting fails: an error is shown and the group data stays', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.delete = () => { throw new DOMException('delete failed', 'UnknownError') }
  })
  await startGroup(page)
  await openTeacher(page)
  await openGroup(page, 'Otter')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Daten der Gruppe löschen' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die Daten der Gruppe konnten nicht gelöscht werden.')
  await expect(heading(page, 'Gruppenansicht Otter')).toBeVisible()
  expect(await readKey(page, GROUP_KEY)).toMatchObject({ name: 'Otter' })
})

test('the QR codes cannot be drawn: an error is shown, the typed start codes stay', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('canvas blocked') }
  })
  await page.goto('/')
  await openTeacher(page)
  await pickClass(page, 'Otter')
  await page.getByRole('button', { name: 'Startcodes drucken' }).click()
  await expect(heading(page, 'Startcodes')).toBeFocused()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Die QR-Codes konnten nicht erzeugt werden.')
  await expect(page.getByText('Startcode: OTTER')).toBeVisible()
})
