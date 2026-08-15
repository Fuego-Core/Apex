/* ÉTAT DE L'APPLICATION.

   Lecture synchrone (les vues lisent `getState()` sans await), écriture
   asynchrone via le dataStore. C'est ce découplage qui rendra le passage à
   IndexedDB indolore : seul le chargement et l'enregistrement traversent la
   frontière asynchrone, pas les 7 vues.

   Clés utilisées :
     apex.v3            état courant
     apex.live.v3       séance en cours
     apex.backup.vN     copie brute de l'état vN, écrite AVANT de le migrer
     apex.v1, apex.v2   états des versions précédentes — jamais modifiés,
                        jamais supprimés. On lit, on migre à côté. */

import { createDataStore } from '../data/dataStore.js'
import { StateError, StorageError } from '../data/errors.js'
import { freshState, hydrate, dehydrate, validateState, STATE_VERSION } from '../core/schema.js'
import { buildProgram } from '../core/program.js'
import { migrateToCurrent, migrateLiveV1toV2, MigrationError } from '../core/migrate.js'

export const KEYS = {
  /** Là où vit l'état courant. */
  state: `apex.v${STATE_VERSION}`,
  live: `apex.live.v${STATE_VERSION}`,
  v1: 'apex.v1',
  live1: 'apex.live.v1',
  v2: 'apex.v2',
  live2: 'apex.live.v2',
  v3: 'apex.v3',
  live3: 'apex.live.v3',
  backup: 'apex.backup.v1',
  backupAt: 'apex.backup.v1.at',
  backupFor: (version) => `apex.backup.v${version}`,
  backupAtFor: (version) => `apex.backup.v${version}.at`
}

/** Versions antérieures, de la plus récente à la plus ancienne. */
const LEGACY_SOURCES = [
  { key: KEYS.v3, version: 3, live: KEYS.live3 },
  { key: KEYS.v2, version: 2, live: KEYS.live2 },
  { key: KEYS.v1, version: 1, live: KEYS.live1 }
]

let store = null
let state = null
let live = null
let boot = { source: null, migrated: false, report: null, backupKey: null }

const errorListeners = new Set()

/** S'abonner aux échecs d'enregistrement (l'UI en fait une bannière). */
export function onStorageError(listener) {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

function notifyError(error) {
  for (const l of errorListeners) {
    try {
      l(error)
    } catch (e) {
      console.error('APEX: listener d’erreur défaillant', e)
    }
  }
}

/* ---------- démarrage ---------- */

/**
 * Charge l'état : v2 si elle existe, sinon migration non destructive depuis v1,
 * sinon état neuf.
 * @throws {StateError|MigrationError|StorageError} l'app affiche alors un écran
 *         d'erreur explicite — et surtout n'écrase rien.
 */
export async function initState(customStore) {
  store = customStore || createDataStore()

  const existing = await store.get(KEYS.state)
  if (existing && existing.__corrupt) {
    throw new StateError('Les données APEX enregistrées sont illisibles (JSON corrompu).', [
      `Le fichier ${KEYS.state} n’a pas pu être relu.`
    ])
  }

  if (existing) {
    const check = validateState(existing)
    if (!check.ok) throw new StateError('Les données APEX enregistrées sont invalides.', check.errors)
    if (existing.version !== STATE_VERSION) {
      throw new StateError(`Version de données inattendue (v${existing.version}).`, [
        `APEX attend la v${STATE_VERSION}.`
      ])
    }
    state = hydrate(existing)
    live = await readLive()
    boot = { source: 'current', migrated: false, from: STATE_VERSION, report: null, backupKey: null }
    return boot
  }

  for (const legacy of LEGACY_SOURCES) {
    const raw = await store.getRaw(legacy.key)
    if (raw) {
      boot = await migrateFrom(legacy, raw)
      return boot
    }
  }

  state = freshState()
  live = null
  await save()
  boot = { source: 'fresh', migrated: false, from: STATE_VERSION, report: null, backupKey: null }
  return boot
}

/** Migration non destructive depuis une version antérieure. À aucun moment la
 *  source n'est modifiée : on sauvegarde, on convertit, on valide, on écrit
 *  ailleurs, puis on relit ce qui a été écrit. Le moindre échec annule tout. */
async function migrateFrom(legacy, raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new StateError(`Les données APEX v${legacy.version} sont illisibles (JSON corrompu).`, [
      'Elles n’ont pas été modifiées : tu peux les récupérer depuis le navigateur.'
    ])
  }

  // 1. Sauvegarde AVANT toute chose. Pas de sauvegarde => pas de migration.
  const backupKey = KEYS.backupFor(legacy.version)
  try {
    await store.setRaw(backupKey, raw)
    await store.setRaw(KEYS.backupAtFor(legacy.version), new Date().toISOString())
  } catch (e) {
    throw new StateError(`Impossible de sauvegarder les données v${legacy.version} avant migration.`, [
      e instanceof StorageError ? e.userMessage : String(e.message || e),
      'La migration a été annulée : rien n’a été modifié.'
    ])
  }

  // 2. Chaîne de conversion (v1 traverse v2 puis v3), validée à chaque étape.
  const { state: next, reports, from } = migrateToCurrent(parsed)

  // 3. Écriture sous une NOUVELLE clé — la source reste en place.
  try {
    await store.set(KEYS.state, dehydrate(next))
  } catch (e) {
    throw new StateError('Impossible d’écrire les données migrées.', [
      e instanceof StorageError ? e.userMessage : String(e.message || e),
      `Tes données v${legacy.version} sont intactes.`
    ])
  }

  // 4. Relecture de contrôle : on ne fait confiance qu'à ce qui ressort du disque.
  const written = await store.get(KEYS.state)
  const check = written && !written.__corrupt ? validateState(written) : { ok: false, errors: ['Relecture impossible.'] }
  if (!check.ok) {
    // Rollback : on retire l'état douteux, la source reprend la main au prochain démarrage.
    try {
      await store.remove(KEYS.state)
    } catch (e) {
      /* le message d'erreur suffit, la source est intacte de toute façon */
    }
    throw new MigrationError('Vérification après migration échouée : migration annulée.', check.errors)
  }

  state = hydrate(written)

  // 5. Une séance en cours au moment de la migration doit rester reprenable.
  const oldLive = await store.get(legacy.live)
  const migratedLive =
    oldLive && !oldLive.__corrupt
      ? legacy.version === 1
        ? migrateLiveV1toV2(oldLive)
        : Array.isArray(oldLive.entries)
          ? oldLive
          : null
      : null
  if (migratedLive) {
    try {
      await store.set(KEYS.live, migratedLive)
    } catch (e) {
      /* la séance en cours n'est pas critique : on continue sans elle */
    }
  }
  live = migratedLive

  return { source: 'migrated', migrated: true, from, report: reports[reports.length - 1], reports, backupKey }
}

async function readLive() {
  const raw = await store.get(KEYS.live)
  if (!raw || raw.__corrupt || !Array.isArray(raw.entries)) return null
  return raw
}

/** Informations de démarrage (origine des données, rapport de migration). */
export function getBootInfo() {
  return boot
}

/* ---------- lecture ---------- */

export function getState() {
  if (!state) throw new StateError('État non chargé : initState() n’a pas été appelé.')
  return state
}

export function getLive() {
  return live
}

export function findSession(id) {
  return getState().program.find((s) => s.id === id) || null
}

export function findExercise(sessionId, instanceId) {
  const s = findSession(sessionId)
  if (!s) return null
  return s.exercises.find((e) => e.id === instanceId) || null
}

/** Le mouvement (catalogue) derrière une instance d'exercice. */
export function findMovement(exerciseId) {
  return getState().catalog[exerciseId] || null
}

/* ---------- écriture ---------- */

/**
 * Enregistre l'état courant. Ne rejette jamais : les vues appellent `save()`
 * sans await, une promesse rejetée deviendrait une erreur silencieuse. En cas
 * d'échec, les abonnés à `onStorageError` sont prévenus.
 * @returns {Promise<boolean>} true si l'écriture a réussi.
 */
export async function save() {
  const payload = dehydrate(getState())
  const check = validateState(payload)
  if (!check.ok) {
    notifyError(new StateError('Enregistrement refusé : les données sont devenues invalides.', check.errors))
    return false
  }
  try {
    await store.set(KEYS.state, payload)
    return true
  } catch (e) {
    notifyError(e)
    return false
  }
}

/** Séance en cours (ou null pour l'effacer). Ne rejette jamais. */
export async function setLive(next) {
  live = next
  try {
    if (next) await store.set(KEYS.live, next)
    else await store.remove(KEYS.live)
    return true
  } catch (e) {
    notifyError(e)
    return false
  }
}

/* ---------- sauvegarde / restauration ---------- */

export function exportJSON() {
  return JSON.stringify({ ...dehydrate(getState()), exportedAt: new Date().toISOString() }, null, 2)
}

/**
 * Importe un export APEX. Accepte un fichier v2 comme un ancien fichier v1
 * (converti à la volée). Lève une erreur au message lisible en cas de refus.
 */
export async function importJSON(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('Ce n’est pas du JSON valide.')
  }
  if (!data || typeof data !== 'object') throw new Error('Fichier vide ou illisible.')

  if (!Array.isArray(data.program)) {
    throw new Error('Fichier non reconnu : ce n’est pas un export APEX.')
  }

  let next
  if (data.version === STATE_VERSION) {
    const check = validateState(data)
    if (!check.ok) throw new Error(`Fichier invalide — ${check.errors.slice(0, 2).join(' ')}`)
    next = data
  } else {
    // Export d'une version antérieure : on le fait passer par la même chaîne
    // de migration que les données locales.
    try {
      next = migrateToCurrent(data).state
    } catch (e) {
      throw new Error(
        e instanceof MigrationError
          ? `Conversion depuis l’ancien format impossible — ${e.details[0] || e.message}`
          : 'Conversion depuis l’ancien format impossible.'
      )
    }
  }

  const payload = dehydrate(next)
  try {
    await store.set(KEYS.state, payload)
  } catch (e) {
    throw new Error(e instanceof StorageError ? e.userMessage : 'Enregistrement impossible.')
  }
  state = hydrate(payload)
  // Une séance en cours n'a plus de sens face à un programme importé.
  await setLive(null)
  return state
}

/** La sauvegarde automatique la plus récente laissée par une migration. */
export async function getBackupInfo() {
  for (const version of [3, 2, 1]) {
    const raw = await store.getRaw(KEYS.backupFor(version))
    if (raw) {
      return { version, at: await store.getRaw(KEYS.backupAtFor(version)), bytes: raw.length }
    }
  }
  return null
}

/** Contenu brut d'une sauvegarde, pour la réexporter telle quelle. */
export async function getBackupRaw(version = null) {
  if (version) return store.getRaw(KEYS.backupFor(version))
  const info = await getBackupInfo()
  return info ? store.getRaw(KEYS.backupFor(info.version)) : null
}

export async function resetAll() {
  state = freshState()
  await save()
  await setLive(null)
  return state
}

export async function resetProgramKeepHistory() {
  state.program = hydrate({ ...state, program: buildProgram() }).program
  await save()
  await setLive(null)
  return state
}
