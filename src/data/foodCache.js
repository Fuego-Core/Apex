/* CACHE ALIMENTAIRE — un accélérateur, jamais une dépendance.

   Ce cache garde les fiches déjà rapatriées d'Open Food Facts pour qu'un
   produit déjà vu s'ouvre instantanément, hors ligne compris.

   La règle qui le définit, et qui explique chaque choix ci-dessous :

     le cache ne doit jamais être nécessaire pour comprendre le passé.

   Il est donc entièrement jetable. Les lignes du journal portent leur propre
   instantané, la mémoire d'usage aussi : si ce cache disparaît — vidé par le
   navigateur, purgé, ou jamais disponible — les journées historiques restent
   identiques au caractère près, et les récents comme les favoris continuent de
   s'afficher et de se ré-ajouter.

   Conséquence assumée dans le code : AUCUNE opération ne lève. Quand IndexedDB
   manque ou refuse, on renvoie « rien » et l'app continue. */

const DB_NAME = 'apex-foods'
const DB_VERSION = 1
const STORE = 'foods'

/** Au-delà, on purge les fiches les moins utiles. ~2 000 fiches ≈ quelques Mo. */
export const MAX_ENTRIES = 2000

/** Combien de fiches on retire quand la limite est franchie : par paquets,
 *  pour ne pas repurger à chaque ajout. */
const PURGE_BATCH = 200

/* ---------- logique pure (testable sans navigateur) ---------- */

/**
 * L'ordre de sacrifice. Ce qui protège une fiche, dans l'ordre :
 * être épinglée (utilisée par la mémoire d'usage), puis avoir servi récemment,
 * puis avoir servi souvent.
 * @returns {object[]} les fiches les plus sacrifiables d'abord
 */
export function purgeOrder(records, { pinned = new Set() } = {}) {
  return [...records]
    .filter((r) => !pinned.has(r.id))
    .sort((a, b) => {
      const usedA = a.usedCount || 0
      const usedB = b.usedCount || 0
      if (usedA !== usedB) return usedA - usedB
      return String(a.lastSeenAt || '').localeCompare(String(b.lastSeenAt || ''))
    })
}

/** Combien retirer pour repasser sous la limite, avec un peu de marge. */
export function purgeCount(total, max = MAX_ENTRIES) {
  if (total <= max) return 0
  return total - max + PURGE_BATCH
}

/** Classement des résultats du cache : le plus utilisé d'abord, à égalité le plus récent. */
export function rankCacheHits(records) {
  return [...records].sort(
    (a, b) => (b.usedCount || 0) - (a.usedCount || 0) || String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''))
  )
}

/* ---------- IndexedDB ---------- */

const promisify = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/**
 * Ouvre — ou n'ouvre pas — le cache.
 * @param {object} options
 * @param {IDBFactory} options.idb  injectable pour les tests
 * @returns {object} une façade dont toutes les méthodes sont sûres
 */
export function createFoodCache({ idb = globalThis.indexedDB, name = DB_NAME } = {}) {
  let dbPromise = null
  /** 'unknown' | 'ready' | 'unavailable' */
  let status = idb ? 'unknown' : 'unavailable'

  function open() {
    if (status === 'unavailable') return Promise.resolve(null)
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve) => {
      let request
      try {
        request = idb.open(name, DB_VERSION)
      } catch (e) {
        status = 'unavailable'
        return resolve(null)
      }
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('barcode', 'barcode', { unique: false })
          store.createIndex('tokens', 'tokens', { unique: false, multiEntry: true })
          store.createIndex('lastSeenAt', 'lastSeenAt', { unique: false })
        }
      }
      request.onsuccess = () => {
        status = 'ready'
        const db = request.result
        // Navigation privée, quota, base corrompue : on redevient inutile en silence.
        db.onclose = () => {
          dbPromise = null
        }
        resolve(db)
      }
      request.onerror = () => {
        status = 'unavailable'
        resolve(null)
      }
      request.onblocked = () => resolve(null)
    })
    return dbPromise
  }

  /** Toute opération passe par ici : une panne du cache ne remonte jamais. */
  async function safely(mode, work, fallback = null) {
    const db = await open()
    if (!db) return fallback
    try {
      const tx = db.transaction(STORE, mode)
      const result = await work(tx.objectStore(STORE), tx)
      if (mode === 'readwrite') {
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      }
      return result
    } catch (e) {
      return fallback
    }
  }

  return {
    get status() {
      return status
    },

    /** Le cache est-il utilisable ? Utile pour l'écran des réglages, pas pour décider d'un comportement. */
    async available() {
      return (await open()) !== null
    },

    /**
     * Demande au navigateur de ne pas vider ces données sans raison.
     * Un refus n'a aucune conséquence : le cache reste jetable par construction.
     */
    async requestPersistence() {
      try {
        if (!navigator.storage?.persist) return false
        if (await navigator.storage.persisted()) return true
        return await navigator.storage.persist()
      } catch (e) {
        return false
      }
    },

    async estimate() {
      try {
        const est = await navigator.storage.estimate()
        return { quota: est.quota ?? null, usage: est.usage ?? null }
      } catch (e) {
        return { quota: null, usage: null }
      }
    },

    /** Enregistre une fiche. `tokens` est fourni par l'appelant (core/nutrition/foods.js). */
    put(food, { tokens = [], now = new Date() } = {}) {
      if (!food?.id) return Promise.resolve(false)
      return safely(
        'readwrite',
        async (store) => {
          const previous = await promisify(store.get(food.id)).catch(() => null)
          await promisify(
            store.put({
              ...food,
              tokens,
              usedCount: previous?.usedCount || 0,
              lastSeenAt: now.toISOString()
            })
          )
          return true
        },
        false
      )
    },

    async putMany(foods, { tokensOf = () => [], now = new Date() } = {}) {
      let written = 0
      for (const food of foods) {
        if (await this.put(food, { tokens: tokensOf(food), now })) written++
      }
      return written
    },

    /** Lecture par id. Marque l'usage pour que la purge sache quoi épargner. */
    async get(id) {
      const record = await safely('readonly', (store) => promisify(store.get(id)))
      if (record) this.touch(id)
      return record || null
    },

    async getByBarcode(barcode) {
      const record = await safely('readonly', (store) => promisify(store.index('barcode').get(String(barcode))))
      if (record) this.touch(record.id)
      return record || null
    },

    /** Note qu'une fiche a servi. Silencieux et sans attente côté appelant. */
    touch(id, { now = new Date() } = {}) {
      return safely('readwrite', async (store) => {
        const record = await promisify(store.get(id))
        if (!record) return false
        await promisify(store.put({ ...record, usedCount: (record.usedCount || 0) + 1, lastSeenAt: now.toISOString() }))
        return true
      })
    },

    /** Recherche par jetons : tous les mots doivent correspondre. */
    async search(tokens, { limit = 20 } = {}) {
      if (!tokens?.length) return []
      const sets = await safely(
        'readonly',
        async (store) => {
          const index = store.index('tokens')
          const found = []
          for (const token of tokens) {
            const range = IDBKeyRange.bound(token, `${token}￿`)
            found.push(await promisify(index.getAll(range)))
          }
          return found
        },
        []
      )
      if (!sets?.length) return []

      // Intersection : chaque mot tapé doit être présent.
      const counts = new Map()
      for (const records of sets) {
        const seen = new Set()
        for (const record of records) {
          if (seen.has(record.id)) continue
          seen.add(record.id)
          counts.set(record.id, { record, hits: (counts.get(record.id)?.hits || 0) + 1 })
        }
      }
      const matching = [...counts.values()].filter((c) => c.hits === sets.length).map((c) => c.record)
      return rankCacheHits(matching).slice(0, limit)
    },

    count() {
      return safely('readonly', (store) => promisify(store.count()), 0)
    },

    /**
     * Ramène le cache sous la limite. Les fiches épinglées — celles que la
     * mémoire d'usage connaît — ne sont jamais sacrifiées.
     */
    async purge({ pinned = new Set(), max = MAX_ENTRIES } = {}) {
      const total = await this.count()
      const toRemove = purgeCount(total, max)
      if (!toRemove) return 0

      return safely(
        'readwrite',
        async (store) => {
          const all = await promisify(store.getAll())
          const victims = purgeOrder(all, { pinned }).slice(0, toRemove)
          for (const victim of victims) await promisify(store.delete(victim.id))
          return victims.length
        },
        0
      )
    },

    clear() {
      return safely('readwrite', (store) => promisify(store.clear()), false)
    }
  }
}

/** Le cache de l'application. Un seul, ouvert paresseusement. */
let shared = null
export function foodCache() {
  if (!shared) shared = createFoodCache()
  return shared
}

/** Pour les tests et les écrans de diagnostic. */
export function setFoodCache(instance) {
  shared = instance
}
