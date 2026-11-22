import type { Page } from '@playwright/test'

/**
 * Init script: once `window.failPut` is set, every IndexedDB put succeeds and then its transaction aborts,
 * like a quota error at commit. Plain JS string, because it must run untranspiled in the page.
 */
export const FAIL_PUT = `
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function () {
    const request = put.apply(this, arguments)
    const tx = this.transaction
    if (window.failPut) request.addEventListener('success', () => tx.abort())
    return request
  }
`

export const failPut = (page: Page) => page.evaluate(() => { (window as unknown as { failPut?: boolean }).failPut = true })
