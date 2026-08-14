/* dataStore — la seule porte d'entrée vers le stockage.

   Aucune vue, aucun module métier ne parle à localStorage directement. Le jour
   où les photos et la base alimentaire imposeront IndexedDB, on change
   l'adapter ici et rien d'autre ne bouge.

   Les écritures sont sérialisées (une file) : deux `save()` rapprochés ne
   peuvent pas s'entrelacer et produire un état mi-ancien mi-nouveau. */

import { createLocalAdapter } from './adapters/local.js'

export function createDataStore(adapter = createLocalAdapter()) {
  let queue = Promise.resolve()

  /** Enchaîne une écriture derrière les précédentes. */
  function serialize(work) {
    const next = queue.then(work, work)
    // La file ne doit pas mourir sur une erreur : on la relance à vide.
    queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  return {
    get adapterName() {
      return adapter.name
    },

    get(key) {
      return adapter.get(key)
    },

    getRaw(key) {
      return adapter.getRaw(key)
    },

    set(key, value) {
      return serialize(() => adapter.set(key, value))
    },

    setRaw(key, raw) {
      return serialize(() => adapter.setRaw(key, raw))
    },

    remove(key) {
      return serialize(() => adapter.remove(key))
    },

    keys() {
      return adapter.keys()
    },

    /** Attend que toutes les écritures en cours soient terminées. */
    flush() {
      return queue
    }
  }
}
