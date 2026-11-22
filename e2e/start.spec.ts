import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FORBIDDEN_BRAND } from '../src/forbidden-brand'
import { manifest } from '../src/pwa-manifest'

const HEADING = 'Demonstrator der Lionizers GmbH'

test('AE2: start page shows the Lionizers demonstrator heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(FORBIDDEN_BRAND)
  await expect(page).not.toHaveTitle(FORBIDDEN_BRAND)
})

test('page title and theme color come from the manifest', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(manifest.name!)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', manifest.theme_color!)
})

test('AE3: app is installable (manifest fields, active service worker)', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest.name).toBeTruthy()
  expect(manifest.start_url).toBeTruthy()
  expect(manifest.display).toBe('standalone')
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toContain(new URL(page.url()).origin)
})

test('AE4: start page reloads while offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  // The first load is not controlled yet; a second load is served through the worker.
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible()
})

test('AE7: start page has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.goto('/')
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
})
