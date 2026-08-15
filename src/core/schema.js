/* SCHÉMA v2 — forme des données, hydratation, validation.

   Forme persistée (v4) :
   {
     version: 3,
     createdAt, migratedFrom, migratedAt,
     catalog: { [exerciseId]: { id, name, mode, assisted, increment } },
     program: [ { id, name, subtitle, lastDoneAt, exercises: [ instance ] } ],
     history: [ ... ],
     profile: { sex, birthYear, height, goal, experience, activity, ... },
     body:    { weight: [ {date, value} ], waist: [ {date, value} ] },
     goals:   [ { id, kind, title, target, ... } ],
     nutrition: { targets, preferences, foods, usage, meals, recipes, days },
     settings: { sound, vibration }
   }

   Les versions intermédiaires restent validables : chacune est ce que produit
   l'étape précédente de la chaîne de migration, avant d'être portée plus loin.

   Une instance ne stocke QUE ce qui lui appartient (paramètres de travail).
   Le nom, le mode et la nature assistée sont branchés à la lecture depuis le
   catalogue : les vues continuent de lire `ex.name` / `ex.mode` / `ex.assisted`
   comme avant, et une écriture sur ces champs va se ranger dans le catalogue. */

import { buildCatalog } from './catalog.js'
import { buildProgram } from './program.js'

export const STATE_VERSION = 4

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

/** Profil vide : rien n'est inventé, tout est à null tant que l'utilisateur
 *  n'a rien saisi. Un champ absent doit s'afficher comme absent. */
export function emptyProfile() {
  return {
    sex: null,
    birthYear: null,
    height: null,
    goal: null,
    experience: null,
    activity: null,
    trainingDays: null,
    sessionDuration: null,
    updatedAt: null
  }
}

export function emptyBody() {
  return { weight: [], waist: [] }
}

/** Section nutrition vide : aucune cible inventée, aucune collection pré-remplie.
 *  `targets.mode` à null signifie « pas encore configuré », et l'app doit le dire
 *  ainsi plutôt que d'afficher des zéros. */
export function emptyNutrition() {
  return {
    targets: {
      mode: null, // null | 'manual' | 'estimated'
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      mealsPerDay: 4,
      basis: null, // ce qui a servi au calcul, pour pouvoir l'expliquer
      updatedAt: null
    },
    preferences: { excluded: [], diet: null },
    foods: {}, // aliments créés par l'utilisateur — jamais dans le cache jetable
    usage: {}, // mémoire alimentaire : fréquence, dernière fois, dernière quantité, favori
    meals: [],
    recipes: [],
    days: {} // 'AAAA-MM-JJ' -> { date, entries: [], note }
  }
}

export function freshState(now = new Date()) {
  return {
    version: STATE_VERSION,
    createdAt: now.toISOString(),
    migratedFrom: null,
    migratedAt: null,
    catalog: buildCatalog(),
    program: buildProgram(),
    history: [],
    profile: emptyProfile(),
    body: emptyBody(),
    goals: [],
    nutrition: emptyNutrition(),
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
    profile: state.profile ?? emptyProfile(),
    body: state.body ?? emptyBody(),
    goals: state.goals ?? [],
    nutrition: state.nutrition ?? emptyNutrition(),
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
  // Les versions intermédiaires restent validables : ce sont les étapes de la
  // chaîne de migration, chacune contrôlée avant de passer à la suivante.
  if (![2, 3, 4].includes(state.version)) {
    fail(`Version attendue ${STATE_VERSION}, reçue ${state.version}.`)
  }

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

  if (state.version >= 3) {
    if (!isObj(state.profile)) fail('Profil manquant.')
    if (!isObj(state.body) || !Array.isArray(state.body.weight) || !Array.isArray(state.body.waist)) {
      fail('Mesures corporelles manquantes.')
    } else {
      for (const [name, list] of [['poids', state.body.weight], ['tour de taille', state.body.waist]]) {
        for (const e of list) {
          if (!isObj(e) || !isStr(e.date) || !isNum(e.value)) {
            fail(`Une mesure de ${name} est illisible.`)
            break
          }
        }
      }
    }
    if (!Array.isArray(state.goals)) fail('Objectifs manquants.')
    else {
      for (const g of state.goals) {
        if (!isObj(g) || !isStr(g.id) || !isStr(g.kind)) {
          fail('Un objectif est illisible.')
          break
        }
        if (!isNum(g.target)) {
          fail(`Objectif « ${g.title || g.id} » : cible invalide.`)
          break
        }
      }
    }
  }

  if (state.version >= 4) validateNutrition(state.nutrition, fail)

  return { ok: errors.length === 0, errors }
}

/** Contrôles propres à la section nutrition. */
function validateNutrition(nutrition, fail) {
  if (!isObj(nutrition)) return fail('Section nutrition manquante.')

  const t = nutrition.targets
  if (!isObj(t)) fail('Cibles nutritionnelles manquantes.')
  else {
    if (t.mode !== null && t.mode !== 'manual' && t.mode !== 'estimated') {
      fail(`Cibles : mode inconnu (${t.mode}).`)
    }
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber']) {
      if (t[key] !== null && (!isNum(t[key]) || t[key] < 0)) fail(`Cible « ${key} » invalide.`)
    }
  }

  if (!isObj(nutrition.foods)) fail('Aliments personnels manquants.')
  else {
    for (const [id, food] of Object.entries(nutrition.foods)) {
      if (!isObj(food) || food.id !== id) fail(`Aliment « ${id} » : id incohérent.`)
      else if (!isStr(food.name)) fail(`Aliment « ${id} » : nom manquant.`)
      else if (!isNum(food.per) || food.per <= 0) fail(`Aliment « ${id} » : base de référence invalide.`)
      else if (!isNum(food.kcal) || food.kcal < 0) fail(`Aliment « ${id} » : calories invalides.`)
    }
  }

  if (!isObj(nutrition.usage)) fail('Mémoire alimentaire manquante.')
  if (!Array.isArray(nutrition.meals)) fail('Repas enregistrés manquants.')
  if (!Array.isArray(nutrition.recipes)) fail('Recettes manquantes.')

  if (!isObj(nutrition.days)) fail('Journal alimentaire manquant.')
  else {
    for (const [date, day] of Object.entries(nutrition.days)) {
      if (!isObj(day) || !Array.isArray(day.entries)) {
        fail(`Journée « ${date} » illisible.`)
        break
      }
      const bad = day.entries.find(
        (e) => !isObj(e) || !isStr(e.id) || !isNum(e.qty) || !isObj(e.snapshot) || !isNum(e.snapshot.kcal)
      )
      if (bad) {
        // Sans instantané, une ligne de journal dépendrait du catalogue : refusé.
        fail(`Journée « ${date} » : une ligne est incomplète (instantané nutritionnel manquant).`)
        break
      }
    }
  }
}
