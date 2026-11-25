import { test, expect, type Page } from '@playwright/test'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import { MINIGAMES_KEY, type Progress, type StationStatus } from '../src/minigames/progress'
import { CONTRIBUTIONS_KEY, type Contribution } from '../src/collage/layout'
import { FAIL_PUT, failPut } from './fail-put'
import { api, axeClean, heading, openStart, readStored, writeStored } from './helpers'

const names = burgFunkelfels.map((g) => g.reward.standard)
const LOCKED = `Die Collage öffnet sich, wenn ihr alle Stationen bei ${PLACE_NAME} geschafft habt.`

const collage = (page: Page) => page.getByRole('region', { name: 'Collage' })
const canvas = (page: Page) => collage(page).getByRole('img', { name: /^Collage aus:/ })
const save = (page: Page) => collage(page).getByRole('button', { name: 'Collage speichern' })
const saved = (page: Page) => collage(page).getByRole('status')

/** Group screen, then `status` for the first station and done for the rest, then the collection. */
async function openCollage(page: Page, first: StationStatus = 'done', easy = false) {
  await openStart(page)
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  if (easy) {
    await page.getByText('Einstellungen', { exact: true }).click()
    await page.getByLabel('Einfache Sprache').check()
  }
  const progress: Progress = {
    status: Object.fromEntries(burgFunkelfels.map((g, i) => [g.id, i === 0 ? first : 'done'])),
    events: [],
  }
  await writeStored(page, MINIGAMES_KEY, (_, value) => value, progress)
  await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
  await expect(heading(page, 'Sammlung')).toBeFocused()
}

/** A downscaled copy of the canvas: enough to tell two pictures apart. */
const fingerprint = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => {
    const small = document.createElement('canvas')
    small.width = small.height = 64
    small.getContext('2d')!.drawImage(c, 0, 0, 64, 64)
    return small.toDataURL()
  })

async function exportCollage(page: Page) {
  await save(page).click()
  // Encoding a 2048 px PNG plus preview takes seconds on a shared CI runner.
  await expect(saved(page)).toHaveText('Gespeichert. Die Lehrkraft kann den Beitrag freigeben.', { timeout: 20_000 })
}

const describeStored = (page: Page) =>
  readStored(page, CONTRIBUTIONS_KEY, async (list: Contribution[]) =>
    Promise.all(
      list.map(async (c) => {
        const png = await createImageBitmap(c.png)
        const preview = await createImageBitmap(c.preview)
        return { keys: Object.keys(c), items: c.items, type: c.type, released: c.released, png: [c.png.type, png.width, png.height], preview: [c.preview.type, preview.width, preview.height], text: JSON.stringify(c) }
      }),
    ),
  )

const release = (page: Page) =>
  writeStored(page, CONTRIBUTIONS_KEY, (list: Contribution[] | undefined) => list!.map((c) => ({ ...c, released: true })))

test('AE1: before every station is done the collage is locked with an explanation', async ({ page }) => {
  await openStart(page)
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
  await expect(heading(page, 'Sammlung')).toBeFocused()
  await expect(collage(page)).toContainText(LOCKED)
  await expect(collage(page).locator('canvas')).toHaveCount(0)
  await expect(save(page)).toHaveCount(0)
})

test('AE1: a skipped station keeps the collage locked', async ({ page }) => {
  await openCollage(page, 'skipped')
  await expect(collage(page)).toContainText(LOCKED)
  await expect(collage(page).locator('canvas')).toHaveCount(0)
})

test('AE2: after the final quest items and sliders change the picture at once', async ({ page }) => {
  await openCollage(page)
  await expect(canvas(page)).toHaveAccessibleName(`Collage aus: ${names.join(', ')}`)
  let before = await fingerprint(page)
  for (const [label, value, text] of [['Anordnung', '2', 'Verstreut'], ['Größe', '0', 'klein'], ['Farbstimmung', '2', 'Nacht']]) {
    const slider = collage(page).getByRole('slider', { name: label })
    await slider.fill(value)
    await expect(slider).toHaveAttribute('aria-valuetext', text)
    await expect.poll(() => fingerprint(page), label).not.toBe(before)
    before = await fingerprint(page)
  }
  await collage(page).getByRole('checkbox', { name: names[0] }).uncheck()
  await expect(canvas(page)).toHaveAccessibleName(`Collage aus: ${names.slice(1).join(', ')}`)
  await expect.poll(() => fingerprint(page)).not.toBe(before)
  await expect(collage(page).getByText('Otter')).toHaveCount(0)
  await axeClean(page, 'section[aria-labelledby="collage-title"]')
})

test('easy language names the items in the collage like in the collection', async ({ page }) => {
  await openCollage(page, 'done', true)
  const easy = burgFunkelfels.map((g) => g.reward.easy)
  await expect(canvas(page)).toHaveAccessibleName(`Collage aus: ${easy.join(', ')}`)
  for (const name of easy) await expect(collage(page).getByRole('checkbox', { name, exact: true })).toBeChecked()
  await expect(collage(page).getByText(names[0])).toHaveCount(0)
})

test('the save button keeps the keyboard focus while saving and ignores a second press', async ({ page }) => {
  await openCollage(page)
  await save(page).focus()
  await page.keyboard.press('Enter')
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Enter')
  await expect(saved(page)).toHaveText('Gespeichert. Die Lehrkraft kann den Beitrag freigeben.', { timeout: 20_000 })
  await expect(save(page)).toBeFocused()
  await expect.poll(() => describeStored(page)).toHaveLength(1)
})

test('AE3/AE4/AE5: the export is a 2048 px PNG with a 512 px WebP preview and metadata without the group name', async ({ page }) => {
  await openCollage(page)
  await exportCollage(page)
  const [stored] = await describeStored(page)
  expect(stored.png).toEqual(['image/png', 2048, 2048])
  expect(stored.preview).toEqual(['image/webp', 512, 512])
  expect(stored.keys.sort()).toEqual(['createdAt', 'id', 'items', 'png', 'preview', 'released', 'type'])
  expect(stored).toMatchObject({ type: 'item-collage', items: burgFunkelfels.map((g) => g.id), released: false })
  expect(stored.text).not.toMatch(/Otter/)
  await expect(collage(page).getByRole('link', { name: 'PNG herunterladen' })).toHaveAttribute('download', /\.png$/)
  // After a reload the group still sees that the collage is saved and waits for the teacher.
  await page.reload()
  await expect(page.getByText(/^Eure Collage ist gespeichert \(.+\), Stand: wartet auf Freigabe durch die Lehrkraft\.$/)).toBeVisible()
})

test('AE3: a browser without WebP encoding gets a JPEG preview', async ({ page }) => {
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      // Like Safari before 17: an unsupported type silently becomes PNG.
      toBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality)
    }
  })
  await openCollage(page)
  await exportCollage(page)
  const [stored] = await describeStored(page)
  expect(stored.preview).toEqual(['image/jpeg', 512, 512])
})

test('AE6/AE9: only released contributions appear in the interface and the zip export', async ({ page }) => {
  await openCollage(page)
  await exportCollage(page)
  expect(await api(page, '/api/beitraege')).toMatchObject({ status: 200, simulation: 'simulation', json: [] })
  const [{ id }] = await readStored(page, CONTRIBUTIONS_KEY, (list: Contribution[]) => list.map((c) => ({ id: c.id })))
  expect(await api(page, `/api/beitraege/${id}.png`)).toMatchObject({ status: 404 })

  await release(page)
  const list = await api(page, '/api/beitraege')
  expect(list.json).toEqual([{ id, createdAt: expect.any(String), type: 'item-collage', items: burgFunkelfels.map((g) => g.id) }])
  expect(await api(page, `/api/beitraege/${id}.png`)).toMatchObject({ status: 200, type: 'image/png', head: [137, 80, 78, 71] })
  expect(await api(page, `/api/beitraege/${id}.webp`)).toMatchObject({ status: 200, type: 'image/webp' })
  expect(await api(page, '/api/export.zip')).toMatchObject({ status: 200, type: 'application/zip', simulation: 'simulation', head: [0x50, 0x4b, 3, 4] })
  // Opened as a page, the path must reach the interface, not the app shell.
  const opened = await page.goto('/api/beitraege')
  expect(await opened!.json()).toEqual(list.json)
})

test('AE9: the interface is documented as OpenAPI', async ({ page }) => {
  const response = await page.request.get('/openapi.yaml')
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text).toMatch(/^openapi: 3\./m)
  expect(text).toContain('Demonstrator-Simulation')
  for (const path of ['/api/beitraege:', '/api/beitraege/{id}.png:', '/api/export.zip:']) expect(text).toContain(path)
})

test('AE7: a collage with only one item is a valid picture', async ({ page }) => {
  await openCollage(page)
  for (const name of names.slice(1)) await collage(page).getByRole('checkbox', { name }).uncheck()
  await expect(canvas(page)).toHaveAccessibleName(`Collage aus: ${names[0]}`)
  await exportCollage(page)
  const [stored] = await describeStored(page)
  expect(stored.png).toEqual(['image/png', 2048, 2048])
  expect(stored.items).toEqual([burgFunkelfels[0].id])
})

test('AE8: without a chosen item there is an explanation instead of an empty picture', async ({ page }) => {
  await openCollage(page)
  for (const name of names) await collage(page).getByRole('checkbox', { name }).uncheck()
  await expect(collage(page)).toContainText('Wählt mindestens ein Item aus, dann entsteht die Collage.')
  await expect(collage(page).locator('canvas')).toHaveCount(0)
  await expect(save(page)).toBeDisabled()
})

test('a failed save is reported and the next export works', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await openCollage(page)
  await failPut(page, CONTRIBUTIONS_KEY)
  await save(page).click()
  await expect(collage(page).getByRole('alert')).toHaveText('Der Beitrag konnte nicht gespeichert werden.')
  // Above the controls, so it is read before what it is about.
  await expect(collage(page).locator('[role="alert"] ~ fieldset')).toHaveCount(1)
  await expect(collage(page).getByRole('link', { name: 'PNG herunterladen' })).toHaveCount(0)
  await failPut(page, false)
  await exportCollage(page)
  await expect(collage(page).getByRole('alert')).toHaveCount(0)
  expect(await describeStored(page)).toHaveLength(1)
})
