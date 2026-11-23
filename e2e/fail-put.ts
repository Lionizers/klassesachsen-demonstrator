import type { Page } from '@playwright/test'

/**
 * Init script: once `window.failPut` is `true` or equals the key being saved, that IndexedDB put succeeds and then
 * its transaction aborts, like a quota error at commit. Plain JS string, because it must run untranspiled in the page.
 */
export const FAIL_PUT = `
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (value, key) {
    const request = put.apply(this, arguments)
    const tx = this.transaction
    if (window.failPut === true || window.failPut === key) request.addEventListener('success', () => tx.abort())
    return request
  }
`

/** Makes every save fail, only the saves of `key`, or (with `false`) none again. */
export const failPut = (page: Page, key: string | boolean = true) =>
  page.evaluate((k) => { (window as unknown as { failPut?: string | boolean }).failPut = k }, key)
