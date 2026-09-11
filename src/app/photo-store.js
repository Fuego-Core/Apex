const DB_NAME = 'apex-private-media'
const DB_VERSION = 1
const STORE = 'progressPhotos'

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'date' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible'))
  })
}

function run(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    let result
    try {
      result = action(store)
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    tx.oncomplete = () => {
      db.close()
      resolve(result?.result)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error('Erreur IndexedDB'))
    }
  }))
}

export async function saveProgressPhotos(date, files = {}) {
  const current = await getProgressPhotos(date)
  const record = {
    date,
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    front: files.front || current?.front || null,
    side: files.side || current?.side || null,
    back: files.back || current?.back || null
  }
  await run('readwrite', (store) => store.put(record))
  return record
}

export async function getProgressPhotos(date) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(date)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Lecture impossible'))
    tx.oncomplete = () => db.close()
  })
}

export async function listProgressPhotos() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => String(b.date).localeCompare(String(a.date))))
    request.onerror = () => reject(request.error || new Error('Lecture impossible'))
    tx.oncomplete = () => db.close()
  })
}

export async function deleteProgressPhotos(date) {
  await run('readwrite', (store) => store.delete(date))
}
