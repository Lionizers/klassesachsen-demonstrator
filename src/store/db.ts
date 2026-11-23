export const DB_NAME = 'klassesachsen'
export const STORE = 'kv'
/** Fired on window after a save or delete committed; `detail` is the key. */
export const KV_SAVED = 'kv-saved'

let connection: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab'))
  })
  // A failed open must not be cached, or every later call fails too.
  connection.catch(() => (connection = undefined))
  return connection
}

export async function load<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

/** Deletes every key but `keep` in one transaction: either all of them are gone or none. */
export async function removeAllExcept(keep: readonly string[]): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    let removed: IDBValidKey[] = []
    const keys = store.getAllKeys()
    keys.onsuccess = () => {
      removed = keys.result.filter((key) => !keep.includes(key as string))
      for (const key of removed) store.delete(key)
    }
    tx.oncomplete = () => {
      for (const key of removed) dispatchEvent(new CustomEvent(KV_SAVED, { detail: key }))
      resolve()
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}

export async function save(key: string, value: unknown): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => {
      dispatchEvent(new CustomEvent(KV_SAVED, { detail: key }))
      resolve()
    }
    tx.onerror = () => reject(tx.error)
    // Quota errors abort the transaction without an error event on it.
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}
