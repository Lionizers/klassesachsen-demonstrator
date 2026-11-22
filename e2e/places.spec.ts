import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import QRCode from 'qrcode'
import { EARTH_RADIUS_M } from '../src/places/geo'
import { PLACES } from '../src/places/places'
import { DB_NAME, STORE } from '../src/store/db'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const funkelfels = PLACES.find((p) => p.id === 'funkelfels')!
const northOf = (m: number) => ({
  latitude: funkelfels.lat + ((m / EARTH_RADIUS_M) * 180) / Math.PI,
  longitude: funkelfels.lon,
})

async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

/**
 * Camera fake: getUserMedia yields a canvas stream showing `qrImage`, or rejects with a DOMException named `reject`.
 * `barcode` replaces BarcodeDetector with one that reads that text; `null` removes it to force the jsQR path.
 */
async function fakeCamera(page: Page, opts: { reject?: string; qrImage?: string; barcode?: string | null }) {
  await page.addInitScript(({ reject, qrImage, barcode }) => {
    const w = window as unknown as Record<string, unknown>
    if (barcode === null) delete w.BarcodeDetector
    else if (barcode !== undefined)
      w.BarcodeDetector = class {
        static async getSupportedFormats() { return ['qr_code'] }
        async detect() { return [{ rawValue: barcode }] }
      }
    navigator.mediaDevices.getUserMedia = async () => {
      if (reject) throw new DOMException('Camera failed', reject)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 300
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 300, 300)
      if (qrImage) {
        const img = new Image()
        img.src = qrImage
        await img.decode()
        setInterval(() => ctx.drawImage(img, 0, 0, 300, 300), 100)
      }
      return canvas.captureStream(10)
    }
  }, opts)
}

async function openMap(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(page.getByRole('heading', { name: 'Karte der Spielregion' })).toBeVisible()
}

async function openFunkelfels(page: Page) {
  await openMap(page)
  await page.getByRole('button', { name: /^Burg Funkelfels/ }).click()
  await expect(page.getByRole('heading', { name: 'Burg Funkelfels' })).toBeVisible()
}

const FAIL_PUT = `
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function () {
    const request = put.apply(this, arguments)
    const tx = this.transaction
    if (window.failPut) request.addEventListener('success', () => tx.abort())
    return request
  }
`

/** Replaces geolocation; `answer` runs inside the page with the success and error callbacks. */
async function fakeGeolocation(page: Page, answer: string) {
  await page.addInitScript(`
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok, fail) => { ${answer} } },
    })
  `)
}

async function backToMapShows(page: Page, label: string) {
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(page.getByRole('button', { name: label })).toBeVisible()
}

async function dumpStore(page: Page) {
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

test('AE1: map shows three open places, none locked, and is accessible', async ({ page }) => {
  await openMap(page)
  const places = page.getByRole('list', { name: 'Orte' }).getByRole('button')
  await expect(places).toHaveText(['Burg Funkelfels – offen', 'Kloster Krümelbach – offen', 'Mühle Wackelstein – offen'])
  for (const button of await places.all()) await expect(button).toBeEnabled()
  await expect(page.getByRole('img', { name: /Fantasiekarte/ })).toBeVisible()
  await axeClean(page)
})

test('AE2: scanning the place QR code (BarcodeDetector) reaches the place', async ({ page }) => {
  await fakeCamera(page, { barcode: 'FUNKELFELS' })
  await openFunkelfels(page)
  await axeClean(page)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await axeClean(page)
  await backToMapShows(page, 'Burg Funkelfels – angefangen')
})

test('AE2: without BarcodeDetector the QR code is read from camera frames (jsQR)', async ({ page }) => {
  const qrImage = await QRCode.toDataURL('FUNKELFELS', { width: 300, margin: 4 })
  await fakeCamera(page, { barcode: null, qrImage })
  const chunks: string[] = []
  page.on('request', (r) => { if (r.url().includes('jsQR')) chunks.push(r.url()) })
  await openFunkelfels(page)
  expect(chunks).toEqual([])
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible({ timeout: 10_000 })
  expect(chunks).toHaveLength(1)
})

test('AE2: typing the printed code reaches the place', async ({ page }) => {
  await openFunkelfels(page)
  await page.getByLabel('Code vom Schild').fill('funkelfels')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
})

test('AE3: the code of another place is rejected without progress', async ({ page }) => {
  await fakeCamera(page, { barcode: 'WACKELSTEIN' })
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByText('Das ist ein anderer Ort')).toBeVisible()
  await page.getByLabel('Code vom Schild').fill('KRUEMELBACH')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Das ist ein anderer Ort')).toBeVisible()
  await expect(page.getByText('Station erreicht!')).toHaveCount(0)
  await backToMapShows(page, 'Burg Funkelfels – offen')
})

test('AE4: GPS within 100 m reaches the place', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(northOf(100))
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
})

test('AE5: GPS at 101 m does not reach the place and offers the QR code', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(northOf(101))
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await expect(page.getByText('Ihr seid noch nicht nah genug am Ort. Scannt den QR-Code.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'QR-Code scannen' })).toBeVisible()
  await backToMapShows(page, 'Burg Funkelfels – offen')
})

test('AE6: denied camera offers classroom mode, which leads to the quest', async ({ page }) => {
  await fakeCamera(page, { reject: 'NotAllowedError' })
  await openFunkelfels(page)
  await expect(page.getByRole('button', { name: 'Im Klassenzimmer spielen' })).toHaveCount(0)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await page.getByRole('button', { name: 'Im Klassenzimmer spielen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
})

test('AE6: denied GPS offers classroom mode, which leads to the quest', async ({ page }) => {
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await page.getByRole('button', { name: 'Im Klassenzimmer spielen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
})

test('a finished place shows as done and stays done when reached again', async ({ page }) => {
  await openFunkelfels(page)
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await page.getByRole('button', { name: 'Aufgabe erledigt' }).click()
  await expect(page.getByRole('button', { name: 'Burg Funkelfels – fertig' })).toBeVisible()
  await page.getByRole('button', { name: 'Burg Funkelfels – fertig' }).click()
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await backToMapShows(page, 'Burg Funkelfels – fertig')
})

test('AE7: map image and places stay visible offline', async ({ page, context }) => {
  await openMap(page)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  // The first load is not controlled yet; a second load is served through the worker.
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(page.getByRole('img', { name: /Fantasiekarte/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Orte' }).getByRole('button')).toHaveCount(3)
})

test('AE8: no position is stored or sent, only that the place was reached', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(northOf(50))
  await openFunkelfels(page)
  const sent: string[] = []
  page.on('request', (r) => sent.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`))
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  expect(await dumpStore(page)).toEqual({ group: { name: 'Otter', round: 0 }, progress: { funkelfels: 'started' } })
  expect(sent).toEqual([])
})

test('a scan error after the first frames is reported, not swallowed', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0
    ;(window as unknown as Record<string, unknown>).BarcodeDetector = class {
      static async getSupportedFormats() { return ['qr_code'] }
      async detect() {
        calls += 1
        if (calls < 3) return []
        throw new Error('detector crashed')
      }
    }
  })
  await fakeCamera(page, {})
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByText('Der QR-Code konnte nicht gelesen werden. Gebt den Code ein.')).toBeVisible()
})

test('a device without geolocation offers the classroom mode', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
  })
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await expect(page.getByText('Dieses Gerät kann den Standort nicht bestimmen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Im Klassenzimmer spielen' })).toBeVisible()
})

test('saving the reached place fails: the place screen says so', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await openFunkelfels(page)
  await page.evaluate(() => { (window as unknown as { failPut?: boolean }).failPut = true })
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Der Fortschritt konnte nicht gespeichert werden.')).toBeVisible()
  await expect(page.getByText('Station erreicht!')).toHaveCount(0)
})

test('saving the finished task fails: the place screen says so', async ({ page }) => {
  await page.addInitScript(FAIL_PUT)
  await openFunkelfels(page)
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
  await page.evaluate(() => { (window as unknown as { failPut?: boolean }).failPut = true })
  await page.getByRole('button', { name: 'Aufgabe erledigt' }).click()
  await expect(page.getByRole('alert')).toHaveText('Der Fortschritt konnte nicht gespeichert werden.')
  await expect(page.getByRole('button', { name: 'Aufgabe erledigt' })).toBeVisible()
})

test('focus follows the view: map heading after "Zur Karte", place heading, map heading again', async ({ page }) => {
  await openMap(page)
  await expect(page.getByRole('heading', { name: 'Karte der Spielregion' })).toBeFocused()
  await page.getByRole('button', { name: /^Burg Funkelfels/ }).click()
  await expect(page.getByRole('heading', { name: 'Burg Funkelfels' })).toBeFocused()
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(page.getByRole('heading', { name: 'Karte der Spielregion' })).toBeFocused()
})

test('reaching a place is announced in the same live region and focus stays on the screen', async ({ page }) => {
  await openFunkelfels(page)
  // Marks the region node: a replaced node would not be announced.
  await page.getByRole('status').evaluate((el) => el.setAttribute('data-probe', ''))
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByRole('status')).toHaveText('Station erreicht!')
  await expect(page.getByRole('status')).toHaveAttribute('data-probe', '')
  await expect(page.getByRole('heading', { name: 'Burg Funkelfels' })).toBeFocused()
})

test('progress cannot be loaded: the map stays usable with open places', async ({ page }) => {
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (key) {
      if (key === 'progress') throw new Error('broken')
      return get.call(this, key)
    }
  })
  await openMap(page)
  await expect(page.getByRole('alert')).toHaveText('Der Spielstand konnte nicht geladen werden.')
  await expect(page.getByRole('list', { name: 'Orte' }).getByRole('button')).toHaveText([
    'Burg Funkelfels – offen', 'Kloster Krümelbach – offen', 'Mühle Wackelstein – offen',
  ])
  await page.getByRole('button', { name: 'Zurück zur Gruppe' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
})

test('camera unavailable without denial: message, and the code still works', async ({ page }) => {
  await fakeCamera(page, { reject: 'NotFoundError' })
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Die Kamera ist nicht verfügbar. Gebt den Code ein.')
  await expect(page.getByRole('button', { name: 'Im Klassenzimmer spielen' })).toHaveCount(0)
  await page.getByLabel('Code vom Schild').fill('FUNKELFELS')
  await page.getByRole('button', { name: 'Code prüfen' }).click()
  await expect(page.getByText('Station erreicht!')).toBeVisible()
})

test('GPS timeout: the place screen offers the QR code', async ({ page }) => {
  await fakeGeolocation(page, 'fail({ code: 3, PERMISSION_DENIED: 1 })')
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Der Standort ist gerade nicht verfügbar. Scannt den QR-Code.')
  await expect(page.getByRole('button', { name: 'Im Klassenzimmer spielen' })).toHaveCount(0)
})

test('camera image cannot start: the place screen says so', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
  })
  await fakeCamera(page, {})
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'QR-Code scannen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Das Kamerabild konnte nicht gestartet werden.')
})

test('a GPS answer arriving after leaving the place is discarded', async ({ page }) => {
  const { lat, lon } = funkelfels
  await fakeGeolocation(page, `window.answerGps = () => ok({ coords: { latitude: ${lat}, longitude: ${lon} } })`)
  await openFunkelfels(page)
  await page.getByRole('button', { name: 'Standort prüfen' }).click()
  await page.getByRole('button', { name: 'Zurück zur Karte' }).click()
  await expect(page.getByRole('button', { name: 'Burg Funkelfels – offen' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { answerGps: () => void }).answerGps())
  // A late write would land within milliseconds; give it time before reading the store.
  await page.waitForTimeout(300)
  expect(await dumpStore(page)).toEqual({ group: { name: 'Otter', round: 0 } })
  await page.reload()
  await page.getByRole('button', { name: 'Zur Karte' }).click()
  await expect(page.getByRole('button', { name: 'Burg Funkelfels – offen' })).toBeVisible()
})
