import { mkdirSync, writeFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ASK_FOR_HELP, PLACE_NAME, PLACE_WELCOME, burgFunkelfels } from '../src/minigames/burg-funkelfels'
import type { Dilemma, Puzzle } from '../src/minigames/model'
import { FAIL_PUT, failPut } from './fail-put'
import { backToMap, backToStations, checkIn, estimate, heading, openMapFromGroup, openStart, reachPlaceFromGroup, reachPlaceFromMap, solveEstimate, startGroup, WCAG } from './helpers'

const puzzle = burgFunkelfels.find((g): g is Puzzle => g.kind === 'puzzle')!
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
      value: {
        cancel() {},
        getVoices: () => [{ lang: 'de-DE' }],
        speak: (u: SpeechSynthesisUtterance) => w.spoken.push({ text: u.text, rate: u.rate, lang: u.lang }),
      },
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

/** The button in the header that reads the whole current view. */
const readView = (page: Page) => page.getByRole('button', { name: 'Vorlesen', exact: true })
const readText = (page: Page, text: string) => page.getByRole('button', { name: `${text} vorlesen`, exact: true })

async function openSettings(page: Page) {
  await page.getByText('Einstellungen', { exact: true }).click()
}

async function openStation(page: Page, title: string) {
  await page.getByRole('button', { name: title }).click()
  await expect(heading(page, title)).toBeFocused()
}

/** All three roles vote for the first option, which ends on the result with its consequence. */
async function voteDilemma(page: Page) {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: dilemma.options[0].label.standard }).click()
  await expect(heading(page, `${dilemma.title.standard}: geschafft!`)).toBeFocused()
}

async function openCollectionFromStations(page: Page) {
  await backToMap(page)
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
  await page.getByRole('button', { name: 'Sammlung', exact: true }).click()
  await expect(heading(page, 'Sammlung')).toBeFocused()
}

test('AE1: "Vorlesen" in the header reads the current view aloud in German without opening the settings', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await readView(page).click()
  const utterances = await spoken(page)
  expect(utterances).toHaveLength(1)
  expect(utterances[0].lang).toBe('de-DE')
  expect(utterances[0].text).toContain('Gruppe Otter')
})

test('AE1: on a station the prompt and each hint have their own button that reads exactly that text', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Einfache Sprache').check()
  await reachPlaceFromGroup(page)
  await openStation(page, puzzle.title.easy)
  await readText(page, puzzle.prompt.easy).click()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await readText(page, puzzle.hints[0].easy).click()
  expect((await spoken(page)).map((u) => u.text)).toEqual([puzzle.prompt.easy, puzzle.hints[0].easy])
})

test('AE1: the result reads the dilemma consequence and the earned item on their own buttons', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await openStation(page, dilemma.title.standard)
  await voteDilemma(page)
  const consequence = dilemma.options[0].consequence.standard
  const earned = `Du erhältst: ${dilemma.reward.standard}`
  await readText(page, consequence).click()
  await readText(page, earned).click()
  expect((await spoken(page)).map((u) => u.text)).toEqual([consequence, earned])
})

test('AE2: speech rate reaches 0.5 and 1.5 and survives a reload', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  const rate = page.getByLabel('Vorlese-Geschwindigkeit')
  for (const value of ['0.5', '1.5']) {
    await rate.fill(value)
    await readView(page).click()
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
  await reachPlaceFromGroup(page)
  await expect(page.getByText(PLACE_WELCOME.easy, { exact: true })).toBeVisible()
  await openStation(page, puzzle.title.easy)
  await expect(page.getByText(ASK_FOR_HELP.easy, { exact: true })).toBeVisible()
  await expect(page.getByText(puzzle.prompt.easy, { exact: true })).toBeVisible()
  await expect(page.getByText(`Belohnung: ${puzzle.reward.easy}`)).toBeVisible()
  await expect(page.getByText(puzzle.pieces[0].easy, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fuchs Fidelius um Hilfe bitten' }).click()
  await expect(page.getByText(puzzle.hints[0].easy)).toBeVisible()
  await page.reload()
  // The reload restores the place with its stations.
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await expect(page.getByRole('button', { name: dilemma.title.easy })).toBeVisible()
  await expect(page.getByText(puzzle.title.standard)).toHaveCount(0)
})

test('AE3: easy language also names the earned item, on the result and in the collection', async ({ page }) => {
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Einfache Sprache').check()
  await reachPlaceFromGroup(page)
  await solveEstimate(page, 'easy')
  await expect(page.getByText(`Du erhältst: ${estimate.reward.easy}`, { exact: true })).toBeVisible()
  await backToStations(page)
  await openCollectionFromStations(page)
  await expect(page.getByRole('button', { name: `${estimate.reward.easy} tragen` })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Noch offen' })).toContainText(puzzle.reward.easy)
  await expect(page.getByText(estimate.reward.standard)).toHaveCount(0)
})

test('AE4: high contrast gives text at least 7:1 on every view', async ({ page }) => {
  const enhanced = async (view: string) => {
    const result = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze()
    expect(result.violations, view).toEqual([])
    // An unmeasurable text would pass silently, so "could not check" counts as a failure.
    expect(result.incomplete, view).toEqual([])
  }
  await openStart(page)
  await openSettings(page)
  await page.getByLabel('Hoher Kontrast').check()
  await enhanced('start')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await enhanced('group')
  await openMapFromGroup(page)
  await enhanced('map')
  // A place without minigames keeps the success message, whose colour has its own high-contrast value.
  await checkIn(page, 'Kloster Krümelbach', 'KRUEMELBACH')
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await enhanced('place-reached')
  await backToMap(page)
  await reachPlaceFromMap(page)
  await enhanced('stations')
  await openStation(page, puzzle.title.standard)
  await enhanced('puzzle')
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await openStation(page, dilemma.title.standard)
  await enhanced('dilemma')
  await voteDilemma(page)
  await enhanced('dilemma-result')
  await backToStations(page)
  await openStation(page, estimate.title.standard)
  await enhanced('estimate')
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await solveEstimate(page)
  await enhanced('estimate-result')
  await backToStations(page)
  await openCollectionFromStations(page)
  await enhanced('collection')
})

const durationOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el)
    return { name: style.animationName, duration: parseFloat(style.animationDuration) }
  })

test('AE5: slow game tempo doubles the animation time', async ({ page }) => {
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  const normal = { view: await durationOf(page, 'main > section'), item: await durationOf(page, '.earned') }
  expect(normal.view.name).not.toBe('none')
  expect(normal.item.name).not.toBe('none')
  await openSettings(page)
  await page.getByLabel('Spieltempo').selectOption('slow')
  await expect.poll(async () => (await durationOf(page, 'main > section')).duration).toBeCloseTo(normal.view.duration * 2)
  await expect.poll(async () => (await durationOf(page, '.earned')).duration).toBeCloseTo(normal.item.duration * 2)
})

test('AE5: reduced motion switches the animations off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  expect((await durationOf(page, 'main > section')).name).toBe('none')
  expect((await durationOf(page, '.earned')).name).toBe('none')
})

test('AE6: an earned item plays one tone', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  expect(await tones(page)).toHaveLength(1)
})

test('AE6: sound off plays no tone, reading aloud still works', async ({ page }) => {
  await recordOutput(page)
  await startGroup(page)
  await openSettings(page)
  await page.getByLabel('Ton', { exact: true }).uncheck()
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await readView(page).click()
  const { spoken, tones } = await recorded(page)
  expect(tones).toEqual([])
  expect(spoken).toHaveLength(1)
  expect(spoken[0].text).toContain(estimate.reward.standard)
})

test('AE6: a browser whose audio fails still shows the result, and the failure is logged', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).AudioContext = class {
      constructor() { throw new DOMException('no audio device', 'NotSupportedError') }
    }
  })
  const warnings: string[] = []
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()) })
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  expect(warnings.join('\n')).toContain('no audio device')
})

test('AE6: a refused audio start is handled, not left as an unhandled rejection', async ({ page }) => {
  await recordOutput(page)
  await page.addInitScript(() => {
    const Recording = (window as unknown as { AudioContext: new () => { resume: () => Promise<void> } }).AudioContext
    ;(window as unknown as Record<string, unknown>).AudioContext = class extends Recording {
      resume = () => Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError'))
    }
  })
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()) })
  await startGroup(page)
  await reachPlaceFromGroup(page)
  await solveEstimate(page)
  await expect.poll(() => warnings.join('\n')).toContain('autoplay blocked')
  expect(errors).toEqual([])
})

/** Tabs forward until `target` has the focus, checking that every focused control shows an outline of at least 3:1. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement!
      const style = getComputedStyle(el)
      const rgb = (c: string) => c.match(/[\d.]+/g)!.map(Number)
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      // The outline sits outside the element (outline-offset), so it is seen against the first opaque parent background.
      let bg = [255, 255, 255]
      for (let node = el.parentElement; node; node = node.parentElement) {
        const c = rgb(getComputedStyle(node).backgroundColor)
        if (c.length === 3 || c[3] > 0) { bg = c; break }
      }
      const [a, b] = [lum(rgb(style.outlineColor)), lum(bg)]
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      return { tag: el.tagName, name: el.textContent ?? '', style: style.outlineStyle, width: parseFloat(style.outlineWidth), ratio }
    })
    if (['BUTTON', 'INPUT', 'SUMMARY', 'SELECT'].includes(outline.tag)) {
      expect(outline.style, outline.name).not.toBe('none')
      expect(outline.width, outline.name).toBeGreaterThan(0)
      expect(outline.ratio, outline.name).toBeGreaterThanOrEqual(3)
    }
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error(`${target} not reached by Tab`)
}

test('AE7: settings and the whole quest run on the keyboard alone with a visible focus', async ({ page }) => {
  const button = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' })
  await openStart(page)
  const settings = page.getByRole('button', { name: 'Einstellungen' })
  await tabTo(page, settings)
  await page.keyboard.press('Enter')
  await expect(settings).toHaveAttribute('aria-expanded', 'true')
  const rate = page.getByLabel('Vorlese-Geschwindigkeit')
  await tabTo(page, rate)
  await page.keyboard.press('ArrowRight')
  await expect(rate).toHaveValue('1.25')
  const contrast = page.getByLabel('Hoher Kontrast')
  await tabTo(page, contrast)
  await page.keyboard.press('Space')
  await expect(contrast).toBeChecked()
  const tempo = page.getByLabel('Spieltempo')
  await tabTo(page, tempo)
  // Type-ahead picks the option without opening the popup, the same on every platform.
  await page.keyboard.press('l')
  await expect(tempo).toHaveValue('slow')

  await tabTo(page, button('Gruppe Otter'))
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await tabTo(page, button('Zur Karte'))
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Karte der Spielregion')).toBeFocused()
  await tabTo(page, button(new RegExp(`^${PLACE_NAME} – `)))
  await page.keyboard.press('Enter')
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await tabTo(page, page.getByRole('textbox', { name: 'Code vom Schild' }))
  await page.keyboard.type('FUNKELFELS')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await expect(heading(page, PLACE_NAME)).toBeFocused()

  await tabTo(page, button(puzzle.title.standard))
  await page.keyboard.press('Enter')
  await expect(heading(page, puzzle.title.standard)).toBeFocused()
  const second = puzzle.pieces[1].standard
  await tabTo(page, button(`${second} nach oben`))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main').getByRole('status')).toHaveText(`„${second}“ jetzt an Stelle 1.`)
  await expect(page.getByRole('list', { name: 'Reihenfolge' }).getByRole('listitem').first()).toContainText(second)
  await tabTo(page, button('Später nachholen'))
  await page.keyboard.press('Enter')
  await expect(heading(page, PLACE_NAME)).toBeFocused()

  await tabTo(page, button(dilemma.title.standard))
  await page.keyboard.press('Enter')
  await expect(heading(page, dilemma.title.standard)).toBeFocused()
  await tabTo(page, button(dilemma.options[0].label.standard))
  for (const next of ['Navigation', 'Recherche']) {
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: new RegExp(`${next} stimmt ab`) })).toBeVisible()
  }
  await page.keyboard.press('Enter')
  await expect(heading(page, `${dilemma.title.standard}: geschafft!`)).toBeFocused()
  await tabTo(page, button(`Zurück zur Übersicht von ${PLACE_NAME}`))
  await page.keyboard.press('Enter')
  await expect(heading(page, PLACE_NAME)).toBeFocused()

  await tabTo(page, button(estimate.title.standard))
  await page.keyboard.press('Enter')
  await expect(heading(page, estimate.title.standard)).toBeFocused()
  await tabTo(page, page.getByLabel(`Eure Schätzung (${estimate.unit})`))
  await page.keyboard.type(String(estimate.target))
  await page.keyboard.press('Enter')
  await expect(heading(page, `${estimate.title.standard}: geschafft!`)).toBeFocused()
  await tabTo(page, button(`Zurück zur Übersicht von ${PLACE_NAME}`))
})

test('AE8: without speech output the button says that reading aloud is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }))
  await openStart(page)
  await readView(page).click()
  await expect(page.getByRole('alert')).toHaveText('Vorlesen ist in diesem Browser nicht verfügbar.')
})

test('AE8: without a German voice the button says that reading aloud is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { cancel() {}, getVoices: () => [{ lang: 'en-US' }], speak() {} },
  }))
  await openStart(page)
  await readView(page).click()
  await expect(page.getByRole('alert')).toHaveText('Vorlesen ist in diesem Browser nicht verfügbar.')
})

test('AE8: a failed utterance is reported; one cut off by the next request is not', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { speechError: string }
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices: () => [{ lang: 'de-DE' }],
        speak: (u: SpeechSynthesisUtterance) => setTimeout(() => u.onerror?.({ error: w.speechError } as SpeechSynthesisErrorEvent)),
      },
    })
  })
  await openStart(page)
  await page.evaluate(() => { (window as unknown as { speechError: string }).speechError = 'interrupted' })
  await readView(page).click()
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.evaluate(() => { (window as unknown as { speechError: string }).speechError = 'synthesis-failed' })
  await readView(page).click()
  await expect(page.getByRole('alert')).toHaveText('Das Vorlesen hat nicht geklappt.')
})

test('saving the settings fails: the panel says so', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await openStart(page)
  await failPut(page)
  await openSettings(page)
  await page.getByLabel('Hoher Kontrast').check()
  await expect(page.getByRole('alert')).toHaveText('Die Einstellungen konnten nicht gespeichert werden.')
  // Closing the settings must not hide the failure.
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('a save error and a read-aloud notice are shown side by side', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }))
  await openStart(page)
  await failPut(page)
  await openSettings(page)
  await page.getByLabel('Hoher Kontrast').check()
  await expect(page.getByRole('alert')).toHaveText('Die Einstellungen konnten nicht gespeichert werden.')
  await readView(page).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Die Einstellungen konnten nicht gespeichert werden.' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Vorlesen ist in diesem Browser nicht verfügbar.' })).toBeVisible()
})

test('AE9: every view has no WCAG 2.1 A/AA violations and no unmeasured contrast; the reports are kept', async ({ page }) => {
  mkdirSync('axe-report', { recursive: true })
  const check = async (view: string) => {
    const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    writeFileSync(`axe-report/${view}.json`, JSON.stringify(result, null, 2))
    expect(result.violations, view).toEqual([])
    expect(result.incomplete.filter((r) => r.id.startsWith('color-contrast')), view).toEqual([])
  }
  await openStart(page)
  await openSettings(page)
  await check('start-with-settings')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(heading(page, 'Gruppe Otter')).toBeFocused()
  await check('group')
  await openMapFromGroup(page)
  await check('map')
  await checkIn(page, 'Kloster Krümelbach', 'KRUEMELBACH')
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await check('map-place-reached')
  await backToMap(page)
  await page.getByRole('button', { name: new RegExp(`^${PLACE_NAME} – `) }).click()
  await expect(heading(page, PLACE_NAME)).toBeFocused()
  await check('map-place')
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByRole('list', { name: 'Stationen' })).toBeVisible()
  await check('place')
  await openStation(page, puzzle.title.standard)
  await check('station-puzzle')
  await page.getByRole('button', { name: 'Später nachholen' }).click()
  await openStation(page, dilemma.title.standard)
  await check('station-dilemma')
  await voteDilemma(page)
  await check('result-dilemma')
  await backToStations(page)
  await openStation(page, estimate.title.standard)
  await check('station-estimate')
  await page.getByLabel(`Eure Schätzung (${estimate.unit})`).fill(String(estimate.target))
  await page.getByRole('button', { name: 'Prüfen' }).click()
  await expect(heading(page, `${estimate.title.standard}: geschafft!`)).toBeFocused()
  await check('result-estimate')
  await page.getByLabel('Hoher Kontrast').check()
  await page.getByLabel('Einfache Sprache').check()
  await check('result-high-contrast-easy')
  await page.getByLabel('Einfache Sprache').uncheck()
  await backToStations(page)
  await openCollectionFromStations(page)
  await check('collection')
})
