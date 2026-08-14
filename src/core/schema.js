/* SCHÉMA v2 — forme des données, hydratation, validation.

   Forme persistée :
   {
     version: 2,
     createdAt, migratedFrom, migratedAt,
     catalog: { [exerciseId]: { id, name, mode, assisted, increment } },
     program: [ { id, name, subtitle, lastDoneAt, exercises: [ instance ] } ],
     history: [ ... ],
     settings: { sound, vibration }
   }

   Une instance ne stocke QUE ce qui lui appartient (paramètres de travail).
   Le nom, le mode et la nature assistée sont branchés à la lecture depuis le
   catalogue : les vues continuent de lire `ex.name` / `ex.mode` / `ex.assisted`
   comme avant, et une écriture sur ces champs va se ranger dans le catalogue. */

import { buildCatalog } from './catalog.js'
import { buildProgram } from './program.js'

export const STATE_VERSION = 2

/** Champs réellement persistés d'une instance d'exercice. */
const INSTANCE_KEYS = [
  'id',
  'exerciseId',
  'sets',
  'repMin',
  'repMax',
  'secMin',
  'secMax',
  'weight',
  'increment',
  'rest',
  'note',
  'pending'
]

export function freshState(now = new Date()) {
  return {
    version: STATE_VERSION,
    createdAt: now.toISOString(),
    migratedFrom: null,
    migratedAt: null,
    catalog: buildCatalog(),
    program: buildProgram(),
    history: [],
    settings: { sound: true, vibration: true }
  }
}

/* ---------- hydratation ---------- */

/** Branche une instance sur son mouvement : name/mode/assisted deviennent des
 *  fenêtres sur le catalogue, en lecture comme en écriture. */
function bindToCatalog(instance, catalog) {
  const movement = catalog[instance.exerciseId]
  if (!movement) return instance

  const link = (key) =>
    Object.defineProperty(instance, key, {
      enumerable: true,
      configurable: true,
      get: () => catalog[instance.exerciseId]?.[key],
      set: (value) => {
        const m = catalog[instance.exerciseId]
        if (m) m[key] = value
      }
    })

  link('name')
  link('mode')
  link('assisted')
  return instance
}

/** Prépare l'état lu du stockage pour l'usage par les vues. */
export function hydrate(state) {
  for (const session of state.program) {
    session.exercises = session.exercises.map((i) => bindToCatalog({ ...i }, state.catalog))
  }
  return state
}

/** Repasse en forme persistable : aucune donnée dérivée n'est écrite. */
export function dehydrate(state) {
  return {
    version: STATE_VERSION,
    createdAt: state.createdAt,
    migratedFrom: state.migratedFrom ?? null,
    migratedAt: state.migratedAt ?? null,
    catalog: state.catalog,
    program: state.program.map((s) => ({
      id: s.id,
      name: s.name,
      subtitle: s.subtitle,
      lastDoneAt: s.lastDoneAt ?? null,
      exercises: s.exercises.map((ex) => {
        const out = {}
        for (const k of INSTANCE_KEYS) if (ex[k] !== undefined) out[k] = ex[k]
        return out
      })
    })),
    history: state.history,
    settings: state.settings
  }
}

/* ---------- validation ---------- */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.length > 0
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Valide un état v2 avant de l'écrire ou après l'avoir lu.
 * @returns {{ok: boolean, errors: string[]}} messages lisibles par un humain.
 */
export function validateState(state) {
  const errors = []
  const fail = (m) => errors.push(m)

  if (!isObj(state)) return { ok: false, errors: ['Données illisibles : ce n’est pas un objet JSON.'] }
  if (state.version !== STATE_VERSION) fail(`Version attendue ${STATE_VERSION}, reçue ${state.version}.`)

  if (!isObj(state.catalog)) fail('Catalogue d’exercices manquant.')
  else {
    for (const [id, m] of Object.entries(state.catalog)) {
      if (!isObj(m)) fail(`Mouvement « ${id} » illisible.`)
      else if (m.id !== id) fail(`Mouvement « ${id} » : id incohérent (${m.id}).`)
      else if (!isStr(m.name)) fail(`Mouvement « ${id} » : nom manquant.`)
      else if (m.mode !== 'reps' && m.mode !== 'temps') fail(`Mouvement « ${id} » : mode inconnu (${m.mode}).`)
    }
  }

  if (!Array.isArray(state.program)) fail('Programme manquant.')
  else {
    if (!state.program.length) fail('Programme vide : aucune séance.')
    for (const s of state.program) {
      if (!isObj(s) || !isStr(s.id) || !isStr(s.name)) {
        fail('Une séance est illisible (id ou nom manquant).')
        continue
      }
      if (!Array.isArray(s.exercises)) {
        fail(`Séance « ${s.name} » : liste d’exercices manquante.`)
        continue
      }
      for (const ex of s.exercises) {
        if (!isObj(ex) || !isStr(ex.id)) {
          fail(`Séance « ${s.name} » : un exercice est illisible.`)
          continue
        }
        if (!isStr(ex.exerciseId)) {
          fail(`Séance « ${s.name} » : exercice « ${ex.id} » sans mouvement associé.`)
          continue
        }
        if (isObj(state.catalog) && !state.catalog[ex.exerciseId]) {
          fail(`Séance « ${s.name} » : mouvement « ${ex.exerciseId} » absent du catalogue.`)
          continue
        }
        const mode = state.catalog?.[ex.exerciseId]?.mode
        if (!isNum(ex.sets) || ex.sets < 1) fail(`« ${ex.id} » : nombre de séries invalide.`)
        if (!isNum(ex.rest) || ex.rest < 0) fail(`« ${ex.id} » : temps de repos invalide.`)
        if (mode === 'reps') {
          if (!isNum(ex.repMin) || !isNum(ex.repMax) || ex.repMax < ex.repMin) {
            fail(`« ${ex.id} » : fourchette de répétitions invalide.`)
          }
          if (!isNum(ex.weight) || ex.weight < 0) fail(`« ${ex.id} » : poids invalide.`)
          if (!isNum(ex.increment) || ex.increment < 0) fail(`« ${ex.id} » : incrément invalide.`)
        } else if (mode === 'temps') {
          if (!isNum(ex.secMin) || !isNum(ex.secMax)) fail(`« ${ex.id} » : durée invalide.`)
        }
      }
    }
  }

  if (!Array.isArray(state.history)) fail('Historique manquant.')
  else {
    for (const h of state.history) {
      if (!isObj(h) || !isStr(h.id) || !isStr(h.startedAt) || !Array.isArray(h.entries)) {
        fail('Une séance archivée est illisible.')
        break
      }
    }
  }

  if (!isObj(state.settings)) fail('Réglages manquants.')

  return { ok: errors.length === 0, errors }
}
