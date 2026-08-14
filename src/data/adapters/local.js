/* Adapter localStorage — le premier, pas le dernier.

   Il est volontairement asynchrone alors que localStorage ne l'est pas : c'est
   ce qui permettra de brancher IndexedDB (photos, base alimentaire) sans
   toucher une seule vue. L'API asynchrone est le contrat ; localStorage n'est
   qu'une implémentation. */

import { QuotaExceededError, StorageUnavailableError } from '../errors.js'

function isQuota(e) {
  return (
    e &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  )
}

/** @param {Storage} [storage] injectable pour les tests. */
export function createLocalAdapter(storage = globalThis.localStorage) {
  if (!storage) throw new StorageUnavailableError()

  return {
    name: 'localStorage',

    async getRaw(key) {
      try {
        return storage.getItem(key)
      } catch (e) {
        throw new StorageUnavailableError(e)
      }
    },

    async setRaw(key, raw) {
      try {
        storage.setItem(key, raw)
      } catch (e) {
        throw isQuota(e) ? new QuotaExceededError(e) : new StorageUnavailableError(e)
      }
    },

    async get(key) {
      const raw = await this.getRaw(key)
      if (raw === null || raw === undefined) return null
      try {
        return JSON.parse(raw)
      } catch (e) {
        // Donnée corrompue : on le dit, on ne la remplace pas en douce.
        return { __corrupt: true, raw }
      }
    },

    async set(key, value) {
      await this.setRaw(key, JSON.stringify(value))
    },

    async remove(key) {
      try {
        storage.removeItem(key)
      } catch (e) {
        throw new StorageUnavailableError(e)
      }
    },

    async keys() {
      try {
        return Object.keys(storage)
      } catch (e) {
        throw new StorageUnavailableError(e)
      }
    }
  }
}
