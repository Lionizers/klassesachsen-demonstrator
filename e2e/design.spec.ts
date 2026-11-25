import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { GUIDE_NAME, PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Puzzle } from '../src/minigames/model'
import { axeClean, backToMap, backToStations, checkIn, estimate, heading, leaveToGroup, openMapFromGroup, openStart, reachPlaceFromGroup, reachPlaceFromMap, solveEstimate, startGroup } from './helpers'

const IPAD = { width: 1024, height: 768 }
const PHONE = { width: 360, height: 640 }
const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!

const header = (page: Page) => page.getByRole('banner')
const tech = (page: Page) => page.getByRole('region', { name: 'Technik für Prüfer' })
const fidelius = (page: Page) => page.locator('.fidelius').filter({ has: page.getByRole('img', { name: 'Fuchs Fidelius' }) })

/** Contrast of an element's border colour against the page background, by the WCAG formula. */
const borderContrast = (el: Element) => {
  const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number)
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const [a, b] = [lum(rgb(getComputedStyle(el).borderTopColor)), lum(rgb(getComputedStyle(document.body).backgroundColor))]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

test.describe('on an iPad in landscape', () => {
  test.use({ viewport: IPAD })

  test('AE1: the header takes at most 15 % of the height and holds title, offline symbol and the menu', async ({ page }) => {
    await openStart(page)
    await expect(header(page).getByRole('heading', { level: 1 })).toBeVisible()
    await expect(header(page).getByRole('status').filter({ hasText: /^offline bereit$/ })).toBeVisible()
    const menu = header(page).getByRole('navigation', { name: 'Menü' })
    await expect(menu.getByRole('button', { name: 'Vorlesen', exact: true })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Einstellungen' })).toHaveAttribute('aria-expanded', 'false')
    await expect(menu.getByRole('button', { name: 'Lehrkräfte-Ansicht' })).toBeVisible()
    for (const detail of [/kB/, /Sync-Ziel/, /Offene Ergebnisse/]) await expect(header(page)).not.toContainText(detail)
    expect((await header(page).boundingBox())!.height).toBeLessThanOrEqual(IPAD.height * 0.15)
    // Open settings sit below the whole menu row, outside the navigation landmark.
    const teacher = menu.getByRole('button', { name: 'Lehrkräfte-Ansicht' })
    const row = (await teacher.boundingBox())!.y
    await menu.getByRole('button', { name: 'Einstellungen' }).click()
    await expect(page.getByLabel('Hoher Kontrast')).toBeVisible()
    expect((await teacher.boundingBox())!.y).toBe(row)
    await expect(menu.getByLabel('Hoher Kontrast')).toHaveCount(0)
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
      // A tile is a button: its edge needs 3:1 against the page.
      expect(await place.evaluate(borderContrast)).toBeGreaterThanOrEqual(3)
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
    // The item count is the one progress number; no second count of stations.
    await expect(page.getByText(/Stationen geschafft\./)).toHaveCount(0)
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
  await openStart(page)
  await expect(tech(page).getByText(/^Download für offline: [\d.]+ kB$/)).toBeHidden()
  await tech(page).getByText('Technik für Prüfer', { exact: true }).click()
  await expect(tech(page).getByText(/^Download für offline: [\d.]+ kB$/)).toBeVisible()
  await expect(tech(page).getByText('Sync-Ziel: lokale Simulation, kein Server')).toBeVisible()
  await expect(tech(page).getByText(/^Offene Ergebnisse: 0/)).toBeVisible()
  await axeClean(page)
})

test('AE3: Fidelius greets as a figure with a speech bubble and gives the hints in it', async ({ page }) => {
  await openStart(page)
  await expect(fidelius(page)).toBeVisible()
  await expect(fidelius(page)).toContainText('Ich bin Fuchs Fidelius')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await reachPlaceFromGroup(page)
  await expect(fidelius(page)).toContainText('Wählt eine Station')
  await page.getByRole('button', { name: puzzle.title.standard }).click()
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  // The speaker is named for screen readers, since the live region announces only what is added.
  await expect(fidelius(page).locator('p').filter({ hasText: puzzle.hints[0].standard })).toHaveText(`${GUIDE_NAME}: ${puzzle.hints[0].standard}`)
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
  // The rays stay above the sentence, so its text is never drawn over them.
  const burst = (await moment.locator('.burst').boundingBox())!
  expect(burst.y + burst.height).toBeLessThanOrEqual((await moment.getByText(/^Neues Item:/).boundingBox())!.y)
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
  await openStart(page)
  await page.getByText('Einstellungen', { exact: true }).click()
  await page.getByLabel('Hoher Kontrast').check()
  await tech(page).getByText('Technik für Prüfer', { exact: true }).click()
  await enhanced('start with settings and technical details')
  await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
  await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
  await enhanced('teacher')
  // The new surfaces of the quest: tiles, item slots, the bubble with a hint, the reward.
  await page.getByRole('button', { name: 'Zurück zur App' }).click()
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await reachPlaceFromGroup(page)
  await enhanced('stations')
  await page.getByRole('button', { name: puzzle.title.standard }).click()
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(fidelius(page)).toContainText(puzzle.hints[0].standard)
  await enhanced('hint')
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await solveEstimate(page)
  await enhanced('reward')
})

test.describe('on a phone', () => {
  test.use({ viewport: PHONE })

  test('AE7: no view scrolls sideways', async ({ page }) => {
    const fits = async (view: string) => {
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      expect(scroll, view).toBeLessThanOrEqual(width)
    }
    await openStart(page)
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
    await reachPlaceFromMap(page)
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

/** Visible names of the filled buttons in the view: a filled button has white text. */
const filledButtons = (page: Page) =>
  page.locator('main button:visible').evaluateAll((els) => els.filter((b) => getComputedStyle(b).color === 'rgb(255, 255, 255)').map((b) => b.textContent!.trim()))

/** Each locator lies within the first screen of the page, so it is visible without scrolling. */
async function inView(...locators: ReturnType<Page['locator']>[]) {
  for (const locator of locators) {
    const bottom = await locator.evaluate((el) => el.getBoundingClientRect().bottom + scrollY)
    expect(bottom, (await locator.textContent()) ?? '').toBeLessThanOrEqual(IPAD.height)
  }
}

/** Every visible button in the view is a touch target of at least 44 × 44, and the buttons of one row are equally high. */
async function touchTargets(page: Page) {
  for (const box of await page.locator('main button:visible').evaluateAll((els) => els.map((b) => b.getBoundingClientRect()))) {
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44)
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44)
  }
  for (const row of await page.locator('main .actions').all()) {
    const heights = await row.locator(':scope > button').evaluateAll((els) => els.map((b) => b.getBoundingClientRect().height))
    expect(new Set(heights).size, 'buttons of one row').toBeLessThanOrEqual(1)
  }
}

test.describe('#27 station and teacher view on an iPad', () => {
  test.use({ viewport: IPAD })

  for (const mode of ['standard', 'easy'] as const) {
    test(`AE1-AE7/AE12: every station fits the screen with one filled button (${mode}${mode === 'easy' ? ', high contrast' : ''})`, async ({ page }) => {
      await startGroup(page)
      if (mode === 'easy') {
        await page.getByText('Einstellungen', { exact: true }).click()
        await page.getByLabel('Einfache Sprache').check()
        await page.getByLabel('Hoher Kontrast').check()
        await page.getByText('Einstellungen', { exact: true }).click()
      }
      await reachPlaceFromGroup(page)
      for (const [i, game] of burgFunkelfels.entries()) {
        const title = game.title[mode]
        await page.getByRole('button', { name: title }).click()
        await expect(heading(page, title)).toBeFocused()
        const station = page.locator('main section')
        await expect(station.getByText(`Station ${i + 1} von 3`, { exact: true })).toBeVisible()
        // The reward sits beside the title, so the task is read first.
        const reward = station.getByText(`Belohnung: ${game.reward[mode]}`)
        const titleBox = (await heading(page, title).boundingBox())!
        expect((await reward.boundingBox())!.y).toBeLessThan(titleBox.y + titleBox.height)
        const help = page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' })
        const check = page.getByRole('button', { name: 'Prüfen' })
        await inView(heading(page, title), station.getByText(game.prompt[mode]), station.locator('.play'), help, ...(game.kind === 'dilemma' ? [] : [check]))
        if (game.kind !== 'dilemma') expect(await filledButtons(page)).toEqual(['Prüfen'])
        else expect(await filledButtons(page)).toEqual(game.options.map((o) => o.label[mode]))
        if (game.kind !== 'dilemma') {
          // #29 AE1: "Prüfen" sits bottom right in the game card, below the field or list. One read: the view still slides in.
          const m = await station.locator('.play').evaluate((card) => {
            const button = Array.from(card.querySelectorAll('button')).find((b) => b.textContent === 'Prüfen')!.getBoundingClientRect()
            const above = card.querySelector('input, ol')!.getBoundingClientRect()
            const box = card.getBoundingClientRect()
            const pad = parseFloat(getComputedStyle(card).paddingRight) + parseFloat(getComputedStyle(card).borderRightWidth)
            return { right: button.right, inner: box.right - pad, top: button.top, above: above.bottom }
          })
          expect(Math.abs(m.right - m.inner)).toBeLessThanOrEqual(1)
          expect(m.top).toBeGreaterThan(m.above)
        }
        // One read-aloud symbol per text block: 48 × 48, named after its text.
        await help.click()
        const readers = station.locator('button.read-aloud')
        const names = await readers.evaluateAll((els) => els.map((b) => b.getAttribute('aria-label')))
        expect(names.length).toBeGreaterThan(0)
        expect(new Set(names).size).toBe(names.length)
        for (const reader of await readers.all()) {
          await expect(reader).toHaveAccessibleName(/ vorlesen$/)
          const box = (await reader.boundingBox())!
          expect([box.width, box.height]).toEqual([48, 48])
        }
        await touchTargets(page)
        await axeClean(page)
        // The neutral way back leaves the station open; "Später nachholen" is a text button.
        await expect(page.getByRole('button', { name: 'Später nachholen' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await page.getByRole('button', { name: `Zurück zu ${PLACE_NAME}` }).click()
        await expect(heading(page, PLACE_NAME)).toBeFocused()
        await expect(page.getByRole('list', { name: 'Stationen' }).getByRole('listitem').nth(i)).toContainText(/offen$/)
      }
    })
  }

  test('AE8-AE11: the overview is on top, the class picker is a compact tile grid, an empty group points to its start code', async ({ page }) => {
    await openStart(page)
    await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
    const picker = page.getByRole('group', { name: 'Gruppen der Klasse' })
    const cards = page.getByRole('list', { name: 'Gruppen' }).getByRole('listitem')
    // Open while no group is chosen; below the overview.
    await expect(picker).toBeVisible()
    expect((await cards.first().boundingBox())!.y).toBeLessThan((await picker.boundingBox())!.y)
    const tiles = picker.getByRole('button')
    await expect(tiles).toHaveCount(12)
    const boxes = await tiles.evaluateAll((els) => els.map((b) => b.getBoundingClientRect()))
    expect(new Set(boxes.map((b) => b.y)).size).toBeLessThanOrEqual(3)
    expect((await picker.boundingBox())!.height).toBeLessThanOrEqual(220)
    for (const tile of await tiles.all()) await expect(tile).toHaveAttribute('aria-pressed', 'false')
    // The cards stand in a grid; the first row is on screen and its buttons sit on one line at the card foot.
    const firstRow = await cards.evaluateAll((els) => {
      const top = els[0].getBoundingClientRect().y
      return els.filter((el) => el.getBoundingClientRect().y === top).length
    })
    expect(firstRow).toBeGreaterThanOrEqual(2)
    const views = cards.getByRole('button', { name: / ansehen$/ })
    await inView(views.first())
    const bottoms = await views.evaluateAll((els, n) => els.slice(0, n).map((b) => b.getBoundingClientRect().bottom), firstRow)
    expect(new Set(bottoms).size).toBe(1)
    expect(await filledButtons(page)).toHaveLength(0)
    await touchTargets(page)
    await axeClean(page)

    await tiles.filter({ hasText: 'Igel' }).click()
    await expect(tiles.filter({ hasText: 'Igel' })).toHaveAttribute('aria-pressed', 'true')
    const igel = cards.filter({ has: page.getByText('Igel', { exact: true }) })
    await expect(igel).toContainText('Noch nicht gestartet – Startcode verteilen')
    await igel.getByRole('button', { name: 'Startcode für Igel' }).click()
    await expect(heading(page, 'Startcodes')).toBeFocused()
    await expect(page.getByText('Startcode: IGEL')).toBeVisible()

    // With a chosen group the picker starts closed and names the count.
    await page.reload()
    await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
    await expect(page.getByText('Gruppen der Klasse für die Startcodes (1 von 12 gewählt)')).toBeVisible()
    await expect(picker).toBeHidden()
    // Printing the codes stays reachable with the picker closed.
    await expect(page.getByRole('button', { name: 'Startcodes drucken' })).toBeVisible()
  })

  test('the group view shows its indicators as cards in one row with the actions together', async ({ page }) => {
    await openStart(page)
    await page.getByRole('button', { name: 'Lehrkräfte-Ansicht' }).click()
    await page.getByRole('button', { name: 'Beispiel Ahorn ansehen' }).click()
    await expect(heading(page, 'Gruppenansicht Beispiel Ahorn')).toBeFocused()
    const ys = await page.getByRole('list', { name: 'Indikatoren' }).getByRole('listitem').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y))
    expect(new Set(ys).size).toBe(1)
    const actions = page.locator('main .actions').filter({ has: page.getByRole('button', { name: 'Kompetenzraster' }) })
    await expect(actions.getByRole('button')).toHaveText(['Zurück zur Übersicht', 'Kompetenzraster', 'Bericht'])
    await touchTargets(page)
    await axeClean(page)
  })
})

test.describe('#27 station on a phone', () => {
  test.use({ viewport: PHONE })

  test('AE12: every station is one column without sideways scrolling; AE6 holds on the result too', async ({ page }) => {
    await startGroup(page)
    await reachPlaceFromGroup(page)
    for (const game of burgFunkelfels) {
      await page.getByRole('button', { name: game.title.standard }).click()
      await expect(heading(page, game.title.standard)).toBeFocused()
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      expect(scroll, game.title.standard).toBeLessThanOrEqual(width)
      const columns = await page.locator('.station').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      expect(columns, game.title.standard).toBe(1)
      await page.getByRole('button', { name: `Zurück zu ${PLACE_NAME}` }).click()
      await expect(heading(page, PLACE_NAME)).toBeFocused()
    }
    await solveEstimate(page)
    // The earned item scales in; measure the settled layout.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    for (const reader of await page.locator('main section button.read-aloud').all()) {
      await expect(reader).toHaveAccessibleName(/ vorlesen$/)
      const box = (await reader.boundingBox())!
      expect([box.width, box.height]).toEqual([48, 48])
    }
  })
})

/** Distances in one read, so the sliding-in view cannot move between two measurements. */
const gaps = (page: Page) =>
  page.locator('main section').evaluate((section) => {
    const r = (sel: string) => section.querySelector(sel)!.getBoundingClientRect()
    const card = section.querySelector('.play')!
    const pieces = Array.from(section.querySelectorAll('.pieces li')).map((li) => li.getBoundingClientRect())
    return {
      taskToBubble: r('.bubble').top - r('.said').bottom,
      bubbleToHelp: r('.station button[aria-disabled]').top - r('.bubble').bottom,
      cardPadding: Math.min(parseFloat(getComputedStyle(card).paddingTop), parseFloat(getComputedStyle(card).paddingLeft)),
      pieceGap: Math.min(...pieces.slice(1).map((p, i) => p.top - pieces[i].bottom)),
    }
  })

/** Left edges of the buttons in the row holding `name`, in DOM order, and the right edge of the row. */
const row = (page: Page, name: string) =>
  page.locator('main .actions').filter({ has: page.getByRole('button', { name, exact: true }) }).evaluate((el) => ({
    names: Array.from(el.querySelectorAll(':scope > button')).map((b) => b.textContent!.trim()),
    right: el.getBoundingClientRect().right,
    lastRight: el.lastElementChild!.getBoundingClientRect().right,
    firstLeft: el.firstElementChild!.getBoundingClientRect().left,
    left: el.getBoundingClientRect().left,
  }))

test.describe('#29 actions bottom right, airy spacing', () => {
  test.use({ viewport: IPAD })

  test('AE4: the puzzle station has room between its groups, in the card and between pieces', async ({ page }) => {
    await startGroup(page)
    await reachPlaceFromGroup(page)
    await page.getByRole('button', { name: puzzle.title.standard }).click()
    await expect(heading(page, puzzle.title.standard)).toBeFocused()
    const g = await gaps(page)
    expect(Math.round(g.taskToBubble)).toBeGreaterThanOrEqual(16)
    expect(Math.round(g.bubbleToHelp)).toBeGreaterThanOrEqual(16)
    expect(Math.round(g.cardPadding)).toBeGreaterThanOrEqual(20)
    expect(Math.round(g.pieceGap)).toBeGreaterThanOrEqual(8)
  })

  test('AE2/AE3/AE5: card actions bottom right, main action right in its row, two columns of group cards', async ({ page }) => {
    await page.goto('/')
    await expect(heading(page, 'Willkommen beim Demonstrator')).toBeVisible()
    // Welcome checklist: "Ansehen" at the right of each card, level within a row.
    const checks = await page.getByRole('list', { name: 'Prüfliste' }).getByRole('listitem').evaluateAll((els) =>
      els.map((li) => {
        const b = li.querySelector('button')!.getBoundingClientRect()
        const box = li.getBoundingClientRect()
        const pad = parseFloat(getComputedStyle(li).paddingRight) + parseFloat(getComputedStyle(li).borderRightWidth)
        return { gap: box.right - pad - b.right, top: box.top, bottom: b.bottom }
      }))
    for (const c of checks) expect(Math.abs(c.gap)).toBeLessThanOrEqual(1)
    const firstRow = checks.filter((c) => c.top === checks[0].top)
    expect(new Set(firstRow.map((c) => c.bottom)).size).toBe(1)

    await page.getByRole('button', { name: 'Als Lehrkraft ansehen' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
    const cards = await page.getByRole('list', { name: 'Gruppen' }).getByRole('listitem').evaluateAll((els) =>
      els.map((li) => {
        const b = li.querySelector('button')!.getBoundingClientRect()
        const box = li.getBoundingClientRect()
        const style = getComputedStyle(li)
        const pad = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)
        const foot = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)
        return { x: box.left, top: box.top, gap: box.right - pad - b.right, low: box.bottom - foot - b.bottom, bottom: b.bottom }
      }))
    expect(new Set(cards.map((c) => c.x)).size).toBe(2)
    for (const c of cards) {
      expect(Math.abs(c.gap)).toBeLessThanOrEqual(1)
      expect(Math.abs(c.low)).toBeLessThanOrEqual(1)
    }
    for (const top of new Set(cards.map((c) => c.top))) expect(new Set(cards.filter((c) => c.top === top).map((c) => c.bottom)).size).toBe(1)
    // Overview row: ways back on the left, the action on the right.
    const overview = await row(page, 'Startcodes drucken')
    expect(overview.names).toEqual(['Zurück zur App', 'Zurück zur Willkommensseite', 'Startcodes drucken'])
    expect(Math.abs(overview.lastRight - overview.right)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Startcodes drucken' }).click()
    await expect(heading(page, 'Startcodes')).toBeFocused()
    const codes = await row(page, 'Drucken')
    expect(codes.names).toEqual(['Zurück zur Übersicht', 'Drucken'])
    expect(Math.abs(codes.lastRight - codes.right)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()

    await page.getByRole('button', { name: 'Beispiel Ahorn ansehen' }).click()
    await expect(heading(page, 'Gruppenansicht Beispiel Ahorn')).toBeFocused()
    const group = await row(page, 'Bericht')
    expect(group.names).toEqual(['Zurück zur Übersicht', 'Kompetenzraster', 'Bericht'])
    expect(Math.abs(group.firstLeft - group.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(group.lastRight - group.right)).toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: 'Bericht' }).click()
    await expect(heading(page, 'Bericht Beispiel Ahorn')).toBeFocused()
    const report = await row(page, 'Drucken oder als PDF speichern')
    expect(report.names).toEqual(['Zurück zur Gruppenansicht', 'Drucken oder als PDF speichern'])
    expect(Math.abs(report.lastRight - report.right)).toBeLessThanOrEqual(1)
  })

  test('AE3: on the group screen "Zur Karte" and on the QR sheet "Drucken" are the actions on the right', async ({ page }) => {
    await startGroup(page)
    const r = await row(page, 'Zur Karte')
    expect(r.names.at(-1)).toBe('Zur Karte')
    expect(Math.abs(r.lastRight - r.right)).toBeLessThanOrEqual(1)
    await openMapFromGroup(page)
    await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
    await expect(heading(page, PLACE_NAME)).toBeFocused()
    await page.getByRole('button', { name: 'QR-Blatt der Orte zeigen' }).click()
    await expect(heading(page, 'QR-Blatt der Orte')).toBeFocused()
    const sheet = await row(page, 'Drucken')
    expect(sheet.names).toEqual(['Zurück zum Ort', 'Drucken'])
    expect(Math.abs(sheet.lastRight - sheet.right)).toBeLessThanOrEqual(1)
  })
})

test('#29 scope: outside the game card a form button stays beside its field on the left', async ({ page }) => {
  await page.setViewportSize(IPAD)
  await openStart(page)
  for (const name of ['Mit Startcode starten', 'Gruppe anlegen']) {
    const m = await page.getByRole('button', { name }).evaluate((b) => {
      const form = b.closest('form')!
      const pad = parseFloat(getComputedStyle(form).paddingLeft) + parseFloat(getComputedStyle(form).borderLeftWidth)
      return b.getBoundingClientRect().left - (form.getBoundingClientRect().left + pad)
    })
    expect(Math.abs(m), name).toBeLessThanOrEqual(1)
  }
})

test.describe('#29 on a phone', () => {
  test.use({ viewport: PHONE })

  test('AE5: the group cards of the teacher overview stand in one column', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Als Lehrkraft ansehen' }).click()
    await expect(heading(page, 'Lehrkräfte-Ansicht')).toBeFocused()
    const xs = await page.getByRole('list', { name: 'Gruppen' }).getByRole('listitem').evaluateAll((els) => els.map((li) => li.getBoundingClientRect().left))
    expect(new Set(xs).size).toBe(1)
  })
})

test.describe('#35 mobile layout at 375 px', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('U1: a puzzle piece gives its text at least 60 % of the row, left-aligned, without hyphenation', async ({ page }) => {
    await startGroup(page)
    await reachPlaceFromGroup(page)
    await page.getByRole('button', { name: puzzle.title.standard }).click()
    await expect(heading(page, puzzle.title.standard)).toBeFocused()
    const rows = await page.locator('.pieces li').evaluateAll((els) =>
      els.map((li) => {
        const text = li.querySelector('span:not(.grip)')!
        const style = getComputedStyle(text)
        return { share: text.getBoundingClientRect().width / li.getBoundingClientRect().width, align: style.textAlign, hyphens: style.hyphens }
      }))
    for (const r of rows) {
      // 0.58, not 0.6: Linux CI fonts measure ~0.5999; the old side-by-side arrows gave ~0.45.
      expect(r.share).toBeGreaterThanOrEqual(0.58)
      expect(['start', 'left']).toContain(r.align)
      expect(r.hyphens).toBe('manual')
    }
    for (const b of await page.locator('.pieces button').all()) {
      const box = (await b.boundingBox())!
      // Rounded: the grid splits the row into sub-pixel heights.
      expect(Math.round(box.width)).toBeGreaterThanOrEqual(44)
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(40)
    }
  })

  test('U4/U5: a view change shows no frame around the heading; actions stand in one column, main action first', async ({ page }) => {
    await startGroup(page)
    const title = page.getByRole('heading', { name: 'Gruppe Otter', exact: true })
    await expect(title).toBeFocused()
    // Headless Chromium does not set :focus-visible after a scripted focus; a real browser does, so force it.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable')
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'main h2' })
    await cdp.send('CSS.enable')
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] })
    expect(await title.evaluate((h) => getComputedStyle(h).outlineStyle)).toBe('none')
    const r = await page.locator('main .actions').first().evaluate((el) => {
      const kids = Array.from(el.querySelectorAll(':scope > button')).map((b) => ({ name: b.textContent!.trim(), box: b.getBoundingClientRect() }))
      kids.sort((a, b) => a.box.top - b.box.top)
      return { first: kids[0].name, lefts: new Set(kids.map((k) => Math.round(k.box.left))).size, widths: new Set(kids.map((k) => Math.round(k.box.width))).size }
    })
    expect(r.first).toBe('Zur Karte')
    expect(r.lefts).toBe(1)
    expect(r.widths).toBe(1)
  })
})
