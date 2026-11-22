import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function axeClean(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(result.violations).toEqual([])
}

async function readGroupRecord(page: Page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('klassesachsen')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('kv').objectStore('kv').get('group')
          get.onsuccess = () => resolve(get.result)
          get.onerror = () => reject(get.error)
        }
      }),
  )
}

test('AE1/AE3: picking a suggested name creates the group and shows the roles', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('list', { name: 'Vorschläge' }).getByRole('button')).toHaveCount(12)
  await axeClean(page)
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
  const roles = page.getByRole('list', { name: 'Rollen in dieser Runde' }).getByRole('listitem')
  await expect(roles).toHaveText([/Protokoll/, /Navigation/, /Recherche/])
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await axeClean(page)
})

test('AE2: free name entry warns against children names before saving', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Bitte keine Namen von Kindern verwenden')).toBeVisible()
  await page.getByLabel('Eigener Gruppenname').fill('Sternschnuppen')
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Sternschnuppen' })).toBeVisible()
})

test('AE5: whitespace-only name cannot be saved and is explained', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Eigener Gruppenname').fill('   ')
  await expect(page.getByRole('button', { name: 'Gruppe anlegen' })).toBeDisabled()
  await expect(page.getByText('Bitte einen Gruppennamen eingeben.')).toBeVisible()
})

test('AE4/AE6: roles rotate, and group and round survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await page.getByRole('button', { name: 'Neue Runde' }).click()
  const roles = page.getByRole('list', { name: 'Rollen in dieser Runde' }).getByRole('listitem')
  await expect(roles.first()).toHaveText(/Navigation/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
  await expect(roles.first()).toHaveText(/Navigation/)
})

test('AE7: stored data holds only the group name and the round', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gruppe Otter' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe Otter' })).toBeVisible()
  expect(await readGroupRecord(page)).toEqual({ name: 'Otter', round: 0 })
})
