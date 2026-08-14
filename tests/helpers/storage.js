/* Faux localStorage pour les tests : les données sont des propriétés propres,
   les méthodes vivent sur le prototype — comme le vrai Storage, donc
   `Object.keys(storage)` rend bien les clés stockées. */

export class MemoryStorage {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null
  }

  setItem(key, value) {
    this[key] = String(value)
  }

  removeItem(key) {
    delete this[key]
  }

  clear() {
    for (const k of Object.keys(this)) delete this[k]
  }
}

/** Storage qui refuse d'écrire certaines clés, pour simuler un quota plein. */
export class FailingStorage extends MemoryStorage {
  constructor(shouldFail = () => true) {
    super()
    Object.defineProperty(this, 'shouldFail', { value: shouldFail, enumerable: false })
  }

  setItem(key, value) {
    if (this.shouldFail(key)) {
      const e = new Error('quota')
      e.name = 'QuotaExceededError'
      throw e
    }
    super.setItem(key, value)
  }
}
