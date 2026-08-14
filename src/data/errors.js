/* Erreurs de stockage typées : une couche supérieure doit pouvoir dire à
   l'utilisateur CE QUI s'est passé, pas juste « ça n'a pas marché ». */

export class StorageError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'StorageError'
    this.cause = options.cause
    /** Message prêt à afficher, en français, sans jargon. */
    this.userMessage = options.userMessage || message
  }
}

export class StorageUnavailableError extends StorageError {
  constructor(cause) {
    super('Stockage local indisponible', {
      cause,
      userMessage:
        "Ce navigateur bloque le stockage local. En navigation privée, APEX ne peut rien enregistrer."
    })
    this.name = 'StorageUnavailableError'
  }
}

export class QuotaExceededError extends StorageError {
  constructor(cause) {
    super('Quota de stockage dépassé', {
      cause,
      userMessage:
        'Mémoire de l’appareil pleine : la dernière modification n’a pas été enregistrée. Exporte tes données depuis les réglages.'
    })
    this.name = 'QuotaExceededError'
  }
}

export class StateError extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'StateError'
    this.details = details
  }
}
