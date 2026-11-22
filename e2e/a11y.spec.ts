import { mkdirSync, writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLACE_NAME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Dilemma, Estimate, Puzzle } from '../src/minigames/model'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!
const estimate = burgFunkelfels.find((g): g is Estimate => g.kind === 'estimate')!
const dilemma = burgFunkelfels.find((g): g is Dilemma => g.kind === 'dilemma')!

type Spoken = { text: string; rate: number; lang: string }
type Recorded = { spoken: Spoken[]; tones: number[] }

/** Records utterances instead of speaking and tones instead of playing them. */
async function recordOutput(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Recorded & Record<string, unknown>
    w.spoken = []
    w.tones = []
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak: (u: SpeechSynthesisUtterance) => w.spoken.push({ text: u.text, rate: u.rate, lang: u.lang }) },
    })
    w.AudioContext = class {
      currentTime = 0
      destination = {}
      resume = async () => {}
      createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n })
      createOscillator = () => {
        const osc = { frequency: { value: 0 }, connect: (n: unknown) => n, start: () => w.tones.push(osc.frequency.value), stop() {} }
        return osc
      }
    }
  })
}

const recorded = (page: Page) => page.evaluate(() => {
  const { spoken, tones } = window as unknown as Recorded
  return { spoken, tones }
})
const spoken = (page: Page) => page.evaluate(() => (window as unknown as Recorded).spoken)
const tones = (page: Page) => page.evaluate(() => (window as unknown as Recorded).tones)

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

async function openSettings(page: Page) {
  await page.getByText('Einstellungen', { exact: true }).click()
}

async function startGroup(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
}

async function enterPlace(page: Page) {
  await page.getByRole('button', { name: `${PLACE_NAME} erkunden` }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
}

async function solveEstimate(page: Page) {
  await page.getByRole('button', { name: estimate.title.standard }).click()
  await expect(heading(page, estimate.title.standard)).toBeFocused()
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(heading(page, `${estimate.title.standard}: geschafft!`)).toBeFocused()
}

async function reachFunkelfels(page: Page) {
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await page.getByRole('button', { name: /^Burg Funkelfels/ }).click()
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
}

test('AE1: "Vorlesen" reads the current view aloud in German', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Vorlesen' }).click()
  const utterances = await spoken(page)
  expect(utterances).toHaveLength(1)
  expect(utterances[0].lang).toBe('de-DE')
  expect(utterances[0].text).toContain('Gruppe Otter')
})

test('AE2: speech rate reaches 0.5 and 1.5 and survives a reload', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  const rate = page.getByLabel('Vorlese-Geschwindigkeit')
  for (const value of ['0.5', '1.5']) {
    await rate.fill(value)
    await page.getByRole('button', { name: 'Vorlesen' }).click()
  }
  expect((await spoken(page)).map((u) => u.rate)).toEqual([0.5, 1.5])
  await page.reload()
  await openSettings(page)
  await expect(page.getByLabel('Vorlese-Geschwindigkeit')).toHaveValue('1.5')
})

test('AE3: easy language switches the minigame texts and survives a reload', async ({ page }) => {
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Einfache Sprache').check()
  await enterPlace(page)
  await page.getByRole('button', { name: puzzle.title.easy }).click()
  await expect(heading(page, puzzle.title.easy)).toBeVisible()
  await expect(page.getByText(puzzle.prompt.easy)).toBeVisible()
  await expect(page.getByText(puzzle.pieces[0].easy, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(page.getByText(puzzle.hints[0].easy)).toBeVisible()
  await page.reload()
  await enterPlace(page)
  await expect(page.getByRole('button', { name: dilemma.title.easy })).toBeVisible()
  await expect(page.getByText(puzzle.title.standard)).toHaveCount(0)
})

test('AE4: high contrast gives text at least 7:1 on place, station and result', async ({ page }) => {
  const enhanced = async () => {
    const result = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze()
    expect(result.violations).toEqual([])
  }
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Hoher Kontrast').check()
  await enhanced()
  await reachFunkelfels(page)
  await enhanced()
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
  await enterPlace(page)
  await page.getByRole('button', { name: puzzle.title.standard }).click()
  await enhanced()
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await solveEstimate(page)
  await enhanced()
})

const durationOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el)
    return { name: style.animationName, duration: parseFloat(style.animationDuration) }
  })

test('AE5: slow game tempo doubles the animation time', async ({ page }) => {
  await startGroup(page)
  await enterPlace(page)
  await solveEstimate(page)
  const normal = { view: await durationOf(page, 'main > section'), item: await durationOf(page, '.item') }
  expect(normal.view.name).not.toBe('none')
  expect(normal.item.name).not.toBe('none')
  await openSettings(page)
  await page.getByLabel('Spieltempo').selectOption('langsam')
  await expect.poll(async () => (await durationOf(page, 'main > section')).duration).toBeCloseTo(normal.view.duration * 2)
  await expect.poll(async () => (await durationOf(page, '.item')).duration).toBeCloseTo(normal.item.duration * 2)
})

test('AE5: reduced motion switches the animations off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startGroup(page)
  await enterPlace(page)
  await solveEstimate(page)
  expect((await durationOf(page, 'main > section')).name).toBe('none')
  expect((await durationOf(page, '.item')).name).toBe('none')
})

test('AE6: an earned item plays one tone', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await enterPlace(page)
  await solveEstimate(page)
  expect(await tones(page)).toHaveLength(1)
})

test('AE6: sound off plays no tone, reading aloud still works', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Ton', { exact: true }).uncheck()
  await enterPlace(page)
  await solveEstimate(page)
  await page.getByRole('button', { name: 'Vorlesen' }).click()
  const { spoken, tones } = await recorded(page)
  expect(tones).toEqual([])
  expect(spoken).toHaveLength(1)
  expect(spoken[0].text).toContain(estimate.reward.standard)
})

/** Tabs forward until `name` has the focus, checking that every focused control shows an outline. */
async function tabTo(page: Page, name: string) {
  const target = page.getByRole('button', { name, exact: true })
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement!
      const style = getComputedStyle(el)
      return { tag: el.tagName, style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
    })
    if (['BUTTON', 'INPUT', 'SUMMARY', 'SELECT'].includes(outline.tag)) {
      expect(outline.style).not.toBe('none')
      expect(outline.width).toBeGreaterThan(0)
    }
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error(`"${name}" not reached by Tab`)
}

test('AE7: the quest runs on the keyboard alone with a visible focus', async ({ page }) => {
  await page.goto('/')
  await tabTo(page, 'Gruppe Otter')
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await tabTo(page, 'Zur Karte')
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await tabTo(page, 'Zurück zur Gruppe')
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await tabTo(page, `${PLACE_NAME} erkunden`)
  await page.keyboard.press('Enter')
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await tabTo(page, estimate.title.standard)
  await page.keyboard.press('Enter')
  await expect(heading(page, estimate.title.standard)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(`Eure Schätzung (${estimate.unit})`)).toBeFocused()
  await page.keyboard.type(String(estimate.target))
  await page.keyboard.press('Enter')
  await expect(heading(page, `${estimate.title.standard}: geschafft!`)).toBeFocused()
  await tabTo(page, `Zurück zur Übersicht von ${PLACE_NAME}`)
})

test('AE8: without speech output the button says that reading aloud is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }))
  await page.goto('/')
  await openSettings(page)
  await page.getByRole('button', { name: 'Vorlesen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Vorlesen ist in diesem Browser nicht verfügbar.')
})

test('saving the settings fails: the panel says so', async ({ page }) => {
  await page.addInitScript(`
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      const request = put.apply(this, arguments)
      const tx = this.transaction
      request.addEventListener('success', () => tx.abort())
      return request
    }
  `)
  await page.goto('/')
  await openSettings(page)
  await page.getByLabel('Hoher Kontrast').check()
  await expect(page.getByRole('alert')).toHaveText('Die Einstellungen konnten nicht gespeichert werden.')
})

test('AE9: every view has no WCAG 2.1 A/AA violations; the reports are kept', async ({ page }) => {
  mkdirSync('axe-report', { recursive: true })
  const check = async (view: string) => {
    const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    writeFileSync(`axe-report/${view}.json`, JSON.stringify(result, null, 2))
    expect(result.violations, view).toEqual([])
  }
  await page.goto('/')
  await openSettings(page)
  await check('start-with-settings')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await check('group')
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await check('map')
  await page.getByRole('button', { name: /^Burg Funkelfels/ }).click()
  await check('map-place')
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await check('map-place-reached')
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
  await enterPlace(page)
  await check('place')
  for (const game of [puzzle, dilemma]) {
    await page.getByRole('button', { name: game.title.standard }).click()
    await check(`station-${game.kind}`)
    await page.getByRole('button', { name: 'Später nachholen' }).click()
  }
  await page.getByRole('button', { name: estimate.title.standard }).click()
  await check('station-estimate')
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await check('result')
  await page.getByLabel('Hoher Kontrast').check()
  await page.getByLabel('Einfache Sprache').check()
  await check('result-high-contrast-easy')
})
