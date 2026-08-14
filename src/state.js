/* ÉTAT DE L'APPLICATION.

   Lecture synchrone (les vues lisent `getState()` sans await), écriture
   asynchrone via le dataStore. C'est ce découplage qui rendra le passage à
   IndexedDB indolore : seul le chargement et l'enregistrement traversent la
   frontière asynchrone, pas les 7 vues.

   Clés utilisées :
     apex.v2            état courant
     apex.live.v2       séance en cours
     apex.backup.v1     copie brute de l'état v1, écrite AVANT toute migration
     apex.v1            état d'origine — jamais modifié, jamais supprimé */

import { createDataStore } from './data/dataStore.js'
import { StateError, StorageError } from './data/errors.js'
import { freshState, hydrate, dehydrate, validateState } from './core/schema.js'
import { buildProgram } from './core/program.js'
import { migrateV1toV2, migrateLiveV1toV2, MigrationError } from './core/migrate.js'

export const KEYS = {
  v1: 'apex.v1',
  live1: 'apex.live.v1',
  v2: 'apex.v2',
  live2: 'apex.live.v2',
  backup: 'apex.backup.v1',
  backupAt: 'apex.backup.v1.at'
}

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

  const existing = await store.get(KEYS.v2)
  if (existing && existing.__corrupt) {
    throw new StateError('Les données APEX enregistrées sont illisibles (JSON corrompu).', [
      'Le fichier apex.v2 n’a pas pu être relu.'
    ])
  }

  if (existing) {
    const check = validateState(existing)
    if (!check.ok) throw new StateError('Les données APEX enregistrées sont invalides.', check.errors)
    state = hydrate(existing)
    live = await readLive()
    boot = { source: 'v2', migrated: false, report: null, backupKey: null }
    return boot
  }

  const rawV1 = await store.getRaw(KEYS.v1)
  if (rawV1) {
    boot = await migrateFromV1(rawV1)
    return boot
  }

  state = freshState()
  live = null
  await save()
  boot = { source: 'fresh', migrated: false, report: null, backupKey: null }
  return boot
}

async function migrateFromV1(rawV1) {
  let parsed
  try {
    parsed = JSON.parse(rawV1)
  } catch (e) {
    throw new StateError('Les données APEX v1 sont illisibles (JSON corrompu).', [
      'Elles n’ont pas été modifiées : tu peux les récupérer depuis le navigateur.'
    ])
  }

  // 1. Sauvegarde AVANT toute chose. Pas de sauvegarde => pas de migration.
  try {
    await store.setRaw(KEYS.backup, rawV1)
    await store.setRaw(KEYS.backupAt, new Date().toISOString())
  } catch (e) {
    throw new StateError('Impossible de sauvegarder les données v1 avant migration.', [
      e instanceof StorageError ? e.userMessage : String(e.message || e),
      'La migration a été annulée : rien n’a été modifié.'
    ])
  }

  // 2. Conversion + validation (migrateV1toV2 refuse de rendre un état invalide).
  const { state: next, report } = migrateV1toV2(parsed)

  // 3. Écriture sous une NOUVELLE clé — apex.v1 reste en place.
  try {
    await store.set(KEYS.v2, dehydrate(next))
  } catch (e) {
    throw new StateError('Impossible d’écrire les données migrées.', [
      e instanceof StorageError ? e.userMessage : String(e.message || e),
      'Tes données v1 sont intactes.'
    ])
  }

  // 4. Relecture de contrôle : on ne fait confiance qu'à ce qui est ressorti du disque.
  const written = await store.get(KEYS.v2)
  const check = written && !written.__corrupt ? validateState(written) : { ok: false, errors: ['Relecture impossible.'] }
  if (!check.ok) {
    // Rollback : on retire la v2 douteuse, la v1 reprend la main au prochain démarrage.
    try {
      await store.remove(KEYS.v2)
    } catch (e) {
      /* le message d'erreur suffit, la v1 est intacte de toute façon */
    }
    throw new MigrationError('Vérification après migration échouée : migration annulée.', check.errors)
  }

  state = hydrate(written)

  // 5. Une séance en cours au moment de la migration doit rester reprenable.
  const oldLive = await store.get(KEYS.live1)
  const migratedLive = oldLive && !oldLive.__corrupt ? migrateLiveV1toV2(oldLive) : null
  if (migratedLive) {
    try {
      await store.set(KEYS.live2, migratedLive)
    } catch (e) {
      /* la séance en cours n'est pas critique : on continue sans elle */
    }
  }
  live = migratedLive

  return { source: 'migrated', migrated: true, report, backupKey: KEYS.backup }
}

async function readLive() {
  const raw = await store.get(KEYS.live2)
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
    await store.set(KEYS.v2, payload)
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
    if (next) await store.set(KEYS.live2, next)
    else await store.remove(KEYS.live2)
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

  let next
  if (data.version === 2) {
    const check = validateState(data)
    if (!check.ok) throw new Error(`Fichier v2 invalide — ${check.errors.slice(0, 2).join(' ')}`)
    next = data
  } else if (Array.isArray(data.program)) {
    try {
      next = migrateV1toV2(data).state
    } catch (e) {
      throw new Error(
        e instanceof MigrationError
          ? `Conversion depuis l’ancien format impossible — ${(e.details[0] || e.message)}`
          : 'Conversion depuis l’ancien format impossible.'
      )
    }
  } else {
    throw new Error('Fichier non reconnu : ni un export APEX v2, ni un export v1.')
  }

  const payload = dehydrate(next)
  try {
    await store.set(KEYS.v2, payload)
  } catch (e) {
    throw new Error(e instanceof StorageError ? e.userMessage : 'Enregistrement impossible.')
  }
  state = hydrate(payload)
  // Une séance en cours n'a plus de sens face à un programme importé.
  await setLive(null)
  return state
}

/** La sauvegarde automatique de l'état v1, si elle existe. */
export async function getBackupInfo() {
  const raw = await store.getRaw(KEYS.backup)
  if (!raw) return null
  return { at: await store.getRaw(KEYS.backupAt), bytes: raw.length }
}

/** Contenu brut de la sauvegarde v1, pour la réexporter telle quelle. */
export function getBackupRaw() {
  return store.getRaw(KEYS.backup)
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
