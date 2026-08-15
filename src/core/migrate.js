/* MIGRATION v1 → v2 — strictement non destructive.

   Règle : on ne touche JAMAIS à `apex.v1`. On le lit, on en fabrique une v2 à
   côté, on la valide, et seulement si elle est valide on l'écrit sous sa
   propre clé. En cas d'échec, l'état v1 est toujours là, intact.

   Ce que la migration doit garantir :
   - aucune séance archivée perdue ;
   - aucun poids courant, incrément, note ou fourchette de reps perdu ;
   - l'historique d'un même mouvement réuni sous un id stable, même quand il
     apparaît dans deux séances différentes (Push et Upper) ;
   - une séance en cours au moment de la migration reste reprenable. */

import { buildCatalog, catalogIdByName, nameKey, resolveOrCreate } from './catalog.js'
import { STATE_VERSION, validateState, emptyProfile, emptyBody, emptyNutrition } from './schema.js'

export class MigrationError extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'MigrationError'
    this.details = details
  }
}

const INSTANCE_NUMERIC = ['sets', 'repMin', 'repMax', 'secMin', 'secMax', 'weight', 'increment', 'rest']

/**
 * Convertit un état v1 en état v2.
 * @returns {{state: object, report: object}}
 * @throws {MigrationError} si le résultat ne passe pas la validation.
 */
export function migrateV1toV2(v1, { now = new Date() } = {}) {
  if (!v1 || typeof v1 !== 'object') {
    throw new MigrationError('État v1 illisible : rien à migrer.')
  }
  if (!Array.isArray(v1.program)) {
    throw new MigrationError('État v1 sans programme : migration impossible.')
  }

  const catalog = buildCatalog()
  const byName = catalogIdByName(catalog)
  const createdMovements = []
  const conflicts = []
  const instanceToMovement = new Map()

  /** Retrouve le mouvement d'un exercice v1, ou en crée un pour un nom inconnu. */
  function movementFor({ name, mode, assisted, increment }) {
    const known = byName[nameKey(name)]
    if (known) return known
    const id = resolveOrCreate(catalog, {
      name,
      mode: mode === 'temps' ? 'temps' : 'reps',
      assisted: !!assisted,
      increment: Number.isFinite(Number(increment)) ? Number(increment) : 2.5
    })
    byName[nameKey(name)] = id
    createdMovements.push({ id, name })
    return id
  }

  /* ---------- programme ---------- */

  const program = v1.program.map((session) => ({
    id: String(session.id),
    name: String(session.name ?? session.id),
    subtitle: String(session.subtitle ?? ''),
    lastDoneAt: session.lastDoneAt ?? null,
    exercises: (session.exercises || []).map((ex) => {
      const exerciseId = movementFor(ex)
      instanceToMovement.set(String(ex.id), exerciseId)

      // Un réglage fait par l'utilisateur en v1 l'emporte sur la valeur d'origine
      // du catalogue : c'est SA donnée, pas notre valeur par défaut.
      const movement = catalog[exerciseId]
      if (typeof ex.assisted === 'boolean' && ex.assisted !== movement.assisted) {
        if (conflicts.some((c) => c.exerciseId === exerciseId)) {
          conflicts.push({ exerciseId, name: movement.name, field: 'assisted', ignored: true })
        } else {
          movement.assisted = ex.assisted
          conflicts.push({ exerciseId, name: movement.name, field: 'assisted', ignored: false })
        }
      }

      const instance = { id: String(ex.id), exerciseId, note: String(ex.note ?? ''), pending: ex.pending ?? null }
      for (const key of INSTANCE_NUMERIC) {
        if (ex[key] !== undefined && ex[key] !== null) {
          const v = Number(ex[key])
          if (Number.isFinite(v)) instance[key] = v
        }
      }
      if (instance.increment === undefined) instance.increment = movement.increment ?? 2.5
      if (instance.rest === undefined) instance.rest = 0
      return instance
    })
  }))

  /* ---------- historique ---------- */

  let relinked = 0
  const history = (v1.history || []).map((h) => ({
    ...h,
    entries: (h.entries || []).map((e) => {
      const fromInstance = instanceToMovement.get(String(e.exerciseId))
      const exerciseId = fromInstance || movementFor({ name: e.name, mode: e.mode, assisted: e.assisted })
      relinked++
      return {
        ...e,
        // `exerciseId` désigne désormais le MOUVEMENT ; l'ancien id d'instance
        // est conservé, il dit dans quelle séance ça avait été fait.
        exerciseId,
        instanceId: e.instanceId ?? String(e.exerciseId ?? ''),
        name: e.name ?? catalog[exerciseId]?.name ?? ''
      }
    })
  }))

  const state = {
    version: 2,
    createdAt: v1.createdAt ?? now.toISOString(),
    migratedFrom: 1,
    migratedAt: now.toISOString(),
    catalog,
    program,
    history,
    settings: {
      sound: v1.settings?.sound ?? true,
      vibration: v1.settings?.vibration ?? true
    }
  }

  const check = validateState(state)
  if (!check.ok) {
    throw new MigrationError('La migration a produit des données invalides.', check.errors)
  }

  return {
    state,
    report: {
      sessions: program.length,
      instances: program.reduce((a, s) => a + s.exercises.length, 0),
      movements: Object.keys(catalog).length,
      createdMovements,
      conflicts,
      historyEntries: history.length,
      relinkedExercises: relinked
    }
  }
}

/** Séance en cours : le champ pointe une instance, on le nomme enfin correctement. */
export function migrateLiveV1toV2(live) {
  if (!live || typeof live !== 'object' || !Array.isArray(live.entries)) return null
  return {
    sessionId: live.sessionId,
    startedAt: live.startedAt,
    entries: live.entries.map((e) => ({
      instanceId: e.instanceId ?? e.exerciseId,
      sets: Array.isArray(e.sets) ? e.sets : []
    }))
  }
}

/**
 * v2 -> v3 : ajoute le profil, les mesures corporelles et les objectifs.
 * Purement additif — rien de l'existant n'est touché, relu ni réinterprété.
 */
export function migrateV2toV3(v2, { now = new Date() } = {}) {
  if (!v2 || typeof v2 !== 'object') {
    throw new MigrationError('État v2 illisible : rien à migrer.')
  }

  const state = {
    ...v2,
    version: 3,
    migratedAt: now.toISOString(),
    profile: v2.profile ?? emptyProfile(),
    body: {
      weight: Array.isArray(v2.body?.weight) ? v2.body.weight : [],
      waist: Array.isArray(v2.body?.waist) ? v2.body.waist : []
    },
    goals: Array.isArray(v2.goals) ? v2.goals : []
  }

  const check = validateState(state)
  if (!check.ok) {
    throw new MigrationError('La migration v2 → v3 a produit des données invalides.', check.errors)
  }
  return { state, report: { added: ['profile', 'body', 'goals'] } }
}

/**
 * v3 -> v4 : ajoute la section nutrition. Purement additive, comme la
 * précédente : rien de l'existant n'est relu, réécrit ni réinterprété.
 */
export function migrateV3toV4(v3, { now = new Date() } = {}) {
  if (!v3 || typeof v3 !== 'object') {
    throw new MigrationError('État v3 illisible : rien à migrer.')
  }

  const previous = v3.nutrition && typeof v3.nutrition === 'object' ? v3.nutrition : {}
  const empty = emptyNutrition()

  const state = {
    ...v3,
    version: 4,
    migratedAt: now.toISOString(),
    nutrition: {
      targets: { ...empty.targets, ...(previous.targets || {}) },
      preferences: { ...empty.preferences, ...(previous.preferences || {}) },
      foods: previous.foods && typeof previous.foods === 'object' ? previous.foods : empty.foods,
      usage: previous.usage && typeof previous.usage === 'object' ? previous.usage : empty.usage,
      meals: Array.isArray(previous.meals) ? previous.meals : empty.meals,
      recipes: Array.isArray(previous.recipes) ? previous.recipes : empty.recipes,
      days: previous.days && typeof previous.days === 'object' ? previous.days : empty.days
    }
  }

  const check = validateState(state)
  if (!check.ok) {
    throw new MigrationError('La migration v3 → v4 a produit des données invalides.', check.errors)
  }
  return { state, report: { added: ['nutrition'] } }
}

/** La chaîne, dans l'ordre. Ajouter une version = ajouter une ligne ici. */
export const MIGRATIONS = [
  { from: 1, to: 2, run: migrateV1toV2 },
  { from: 2, to: 3, run: migrateV2toV3 },
  { from: 3, to: 4, run: migrateV3toV4 }
]

/**
 * Applique toutes les migrations nécessaires pour amener un état à la version
 * courante. Un état v1 traverse donc v2 puis v3 en un seul démarrage.
 * @returns {{state, reports: object[], from: number}}
 */
export function migrateToCurrent(state, options = {}) {
  const from = Number(state?.version) || 1
  if (from > STATE_VERSION) {
    throw new MigrationError(
      `Ces données viennent d’une version plus récente d’APEX (v${from}).`,
      ['Mets l’application à jour avant de les importer.']
    )
  }

  let current = state
  const reports = []
  for (const step of MIGRATIONS) {
    if (step.from < from) continue
    const { state: next, report } = step.run(current, options)
    reports.push({ from: step.from, to: step.to, ...report })
    current = next
  }

  if (current.version !== STATE_VERSION) {
    throw new MigrationError(`Migration incomplète : arrêtée en v${current.version}.`)
  }
  return { state: current, reports, from }
}
