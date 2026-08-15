/* Nutrition — mutations.

   Ces fonctions modifient le document en mémoire puis délèguent
   l'enregistrement. Aucune ne parle au stockage, aucune ne calcule : les
   calculs vivent dans core/nutrition/. */

import { getState, save } from './index.js'
import { uid } from '../ui.js'
import { today } from '../core/body.js'
import {
  makeUserFood,
  snapshotOf,
  touchUsage,
  setFavorite as setFavoriteIn,
  validateFoodInput,
  tokensOf,
  queryTokens
} from '../core/nutrition/foods.js'
import { fetchProduct, searchOnline, OffError, ATTRIBUTION } from '../data/openFoodFacts.js'
import { foodCache } from '../data/foodCache.js'
import { makeRecipe, validateRecipeInput, recipeAsFood, isRecipeId, makeItem } from '../core/nutrition/recipes.js'
import { dayOf, addEntry, updateEntry, removeEntry, suggestedMeal, entriesOfMeal, loggedDays } from '../core/nutrition/journal.js'
import { estimateTargets } from '../core/nutrition/targets.js'
import { currentAverage } from '../core/body.js'

/* ---------- cibles ---------- */

/** Cibles saisies à la main : elles priment toujours sur une estimation. */
export function setManualTargets(values) {
  const n = getState().nutrition
  n.targets = {
    ...n.targets,
    ...values,
    mode: 'manual',
    basis: null,
    updatedAt: new Date().toISOString()
  }
  return save()
}

/**
 * Applique une estimation. Ne fait rien si le profil est incomplet : c'est à
 * l'appelant d'afficher ce qui manque.
 * @returns {Promise<{applied: boolean, missing?: string[]}>}
 */
export async function applyEstimatedTargets() {
  const state = getState()
  const estimate = estimateTargets({
    profile: state.profile,
    weightKg: currentAverage(state.body.weight)
  })
  if (estimate.status !== 'ok') return { applied: false, missing: estimate.missing }

  state.nutrition.targets = {
    ...state.nutrition.targets,
    mode: 'estimated',
    kcal: estimate.kcal,
    protein: estimate.protein,
    carbs: estimate.carbs,
    fat: estimate.fat,
    fiber: estimate.fiber,
    basis: estimate.basis,
    updatedAt: new Date().toISOString()
  }
  await save()
  return { applied: true }
}

export function clearTargets() {
  const n = getState().nutrition
  n.targets = { ...n.targets, mode: null, kcal: null, protein: null, carbs: null, fat: null, fiber: null, basis: null }
  return save()
}

/* ---------- aliments personnels ---------- */

/**
 * Crée un aliment personnel.
 * @returns {Promise<{ok: boolean, errors?: object, food?: object}>}
 */
export async function createFood(input) {
  const check = validateFoodInput(input)
  if (!check.ok) return { ok: false, errors: check.errors }

  const state = getState()
  const food = makeUserFood(input, { existing: state.nutrition.foods })
  state.nutrition.foods[food.id] = food
  await save()
  return { ok: true, food }
}

export async function updateFood(id, patch) {
  const state = getState()
  const current = state.nutrition.foods[id]
  if (!current) return { ok: false, errors: { name: 'Aliment introuvable.' } }

  const merged = { ...current, ...patch }
  const check = validateFoodInput(merged)
  if (!check.ok) return { ok: false, errors: check.errors }

  state.nutrition.foods[id] = { ...merged, updatedAt: new Date().toISOString() }
  await save()
  return { ok: true, food: state.nutrition.foods[id] }
}

/** Supprime un aliment personnel. Les lignes déjà enregistrées ne bougent pas :
 *  elles portent leur propre instantané. */
export function removeFood(id) {
  const state = getState()
  delete state.nutrition.foods[id]
  return save()
}

/**
 * Retrouve un aliment utilisable : d'abord les aliments personnels, sinon la
 * mémoire d'usage. Le cache externe s'ajoutera ici en étape 5 — et restera
 * facultatif, puisque la mémoire suffit déjà à afficher et recalculer.
 */
export function resolveFood(id) {
  const n = getState().nutrition
  if (n.foods[id]) return { ...snapshotOf(n.foods[id]), id }
  if (isRecipeId(id)) {
    const recipe = n.recipes.find((r) => r.id === id)
    if (recipe) return { ...snapshotOf(recipeAsFood(recipe)), id }
  }
  const remembered = n.usage[id]?.snapshot
  return remembered ? { ...remembered, id } : null
}

/* ---------- recettes ---------- */

/**
 * Crée une recette. Chaque ingrédient garde son instantané : la recette ne
 * dépend plus de rien après sa création.
 * @returns {Promise<{ok: boolean, errors?: object, recipe?: object}>}
 */
export async function createRecipe(input) {
  const check = validateRecipeInput(input)
  if (!check.ok) return { ok: false, errors: check.errors }

  const state = getState()
  const recipe = makeRecipe(input, { existing: state.nutrition.recipes })
  state.nutrition.recipes.push(recipe)
  await save()
  return { ok: true, recipe }
}

export async function updateRecipe(id, patch) {
  const state = getState()
  const index = state.nutrition.recipes.findIndex((r) => r.id === id)
  if (index < 0) return { ok: false, errors: { name: 'Recette introuvable.' } }

  const merged = { ...state.nutrition.recipes[index], ...patch }
  const check = validateRecipeInput(merged)
  if (!check.ok) return { ok: false, errors: check.errors }

  // Les portions déjà enregistrées ne bougent pas : elles ont leur instantané.
  state.nutrition.recipes[index] = { ...merged, items: merged.items.map(makeItem), updatedAt: new Date().toISOString() }
  await save()
  return { ok: true, recipe: state.nutrition.recipes[index] }
}

export function removeRecipe(id) {
  const state = getState()
  state.nutrition.recipes = state.nutrition.recipes.filter((r) => r.id !== id)
  return save()
}

/** Les recettes vues comme des aliments : c'est sous cette forme que le reste
 *  de l'app les manipule, sans avoir à savoir ce qu'est une recette. */
export function recipeFoods() {
  const out = {}
  for (const recipe of getState().nutrition.recipes) out[recipe.id] = recipeAsFood(recipe)
  return out
}

/* ---------- source extérieure (Open Food Facts) ---------- */

/* Tout ce qui suit est un ACCÉLÉRATEUR. Si le réseau tombe et si le cache
   disparaît, l'app perd la découverte de nouveaux produits — rien d'autre :
   le journal, les récents et les favoris ne dépendent d'aucun des deux. */

/** Une fiche extérieure ramenée au format des lignes du sélecteur. */
function externalRow(food) {
  const remembered = getState().nutrition.usage[food.id]
  // L'attribution suit la provenance : on ne va pas attribuer à Open Food Facts
  // un aliment que l'utilisateur a saisi lui-même.
  const fromOff = (food.source ?? '') === 'open-food-facts'
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    snapshot: {
      ...snapshotOf(food),
      license: fromOff ? food.license ?? 'ODbL 1.0' : null,
      attribution: fromOff ? food.attribution ?? ATTRIBUTION : null
    },
    // Si on l'a déjà mangé, sa quantité habituelle prime sur toute suggestion.
    lastQty: remembered?.lastQty ?? null,
    unit: food.unit || 'g',
    count: remembered?.count || 0,
    lastAt: remembered?.lastAt || null,
    favorite: !!remembered?.favorite,
    external: true,
    derived: food.derived || null
  }
}

/** Les fiches que la mémoire connaît ne doivent jamais être purgées du cache. */
function pinnedIds() {
  return new Set(Object.keys(getState().nutrition.usage))
}

let persistenceAsked = false

async function cacheFoods(foods) {
  const cache = foodCache()
  // Demandée une seule fois, au premier usage réel : un refus ne change rien.
  if (!persistenceAsked) {
    persistenceAsked = true
    cache.requestPersistence()
  }
  await cache.putMany(foods, { tokensOf: (f) => tokensOf(f.name, f.brand) })
  await cache.purge({ pinned: pinnedIds() })
}

/**
 * Recherche en ligne, déclenchée explicitement par l'utilisateur.
 * Le cache répond d'abord — donc instantanément et hors ligne —, le réseau
 * complète ensuite.
 * @returns {Promise<{rows: object[], total: number, skipped: number, warning: string|null}>}
 */
export async function searchFoodsOnline(query) {
  const tokens = queryTokens(query)
  const cached = await foodCache().search(tokens)
  const rows = new Map(cached.map((record) => [record.id, externalRow(record)]))

  try {
    const { foods, total, skipped } = await searchOnline(query)
    for (const food of foods) rows.set(food.id, externalRow(food))
    await cacheFoods(foods)
    return { rows: [...rows.values()], total, skipped, warning: null }
  } catch (e) {
    if (!(e instanceof OffError)) throw e
    // Le réseau a échoué : ce que le cache savait déjà reste affiché, dit comme tel.
    return { rows: [...rows.values()], total: rows.size, skipped: 0, warning: e.userMessage }
  }
}

/**
 * Retrouve un produit par son code-barres : cache d'abord, réseau ensuite.
 * @returns {Promise<{ok: true, row, fromCache: boolean} | {ok: false, code: string, message: string}>}
 */
export async function lookupBarcode(code) {
  const barcode = String(code ?? '').trim()
  const n = getState().nutrition

  // Ce que TU as saisi passe avant tout le reste : si tu as créé cet aliment
  // parce qu'Open Food Facts ne l'avait pas, il ne faut plus jamais te
  // reposer la question.
  const own = Object.values(n.foods).find((f) => f.barcode && String(f.barcode) === barcode)
  if (own) return { ok: true, row: { ...externalRow(own), external: false }, fromCache: true }

  // Puis ce que la mémoire d'usage a déjà retenu : ni réseau, ni cache requis.
  const [id, remembered] =
    Object.entries(n.usage).find(([, e]) => e.snapshot?.barcode && String(e.snapshot.barcode) === barcode) || []
  if (remembered) {
    return {
      ok: true,
      fromCache: true,
      row: {
        id,
        name: remembered.snapshot.name,
        brand: remembered.snapshot.brand,
        snapshot: remembered.snapshot,
        lastQty: remembered.lastQty,
        unit: remembered.unit || remembered.snapshot.unit || 'g',
        count: remembered.count,
        lastAt: remembered.lastAt,
        favorite: !!remembered.favorite
      }
    }
  }

  const cached = await foodCache().getByBarcode(barcode)
  if (cached) return { ok: true, row: externalRow(cached), fromCache: true }

  try {
    const result = await fetchProduct(code)
    if (!result.ok) return result
    await cacheFoods([result.food])
    return { ok: true, row: externalRow(result.food), fromCache: false }
  } catch (e) {
    if (!(e instanceof OffError)) throw e
    return { ok: false, code: e.code, message: e.userMessage }
  }
}

/* ---------- journal ---------- */

/**
 * Enregistre un aliment dans la journée. L'instantané est figé ici, une fois
 * pour toutes : c'est ce qui rend le passé stable.
 */
export async function logFood({ foodId, snapshot = null, qty, unit = null, meal = null, date = null, now = new Date() }) {
  const state = getState()
  const day = date || today(now)
  const values = snapshot || resolveFood(foodId)
  if (!values) return { ok: false, error: 'Aliment introuvable.' }

  const entry = {
    id: uid('nl'),
    meal: meal || suggestedMeal(now),
    foodId,
    qty: Number(qty),
    unit: unit || values.unit || 'g',
    at: now.toISOString(),
    snapshot: { ...values, id: undefined }
  }
  delete entry.snapshot.id

  state.nutrition.days[day] = addEntry(dayOf(state.nutrition.days, day), entry)
  state.nutrition.usage = touchUsage(state.nutrition.usage, foodId, {
    qty: entry.qty,
    unit: entry.unit,
    snapshot: entry.snapshot,
    now
  })
  await save()
  return { ok: true, entry }
}

/**
 * Retrouve le dernier repas de ce type réellement enregistré avant cette date.
 * @returns {{date: string, entries: object[]}|null}
 */
export function lastMealBefore(meal, date) {
  const days = loggedDays(getState().nutrition.days).filter((d) => d.date < date)
  for (const day of days) {
    const entries = entriesOfMeal(day, meal)
    if (entries.length) return { date: day.date, entries }
  }
  return null
}

/**
 * Refait un repas déjà enregistré : les lignes sont RECOPIÉES avec leurs
 * instantanés d'origine, pas re-calculées. Le repas d'hier reste le repas
 * d'hier, et celui d'aujourd'hui vaut exactement ce qu'il valait.
 * @returns {Promise<{ok: boolean, added?: number, reason?: string}>}
 */
export async function repeatMeal({ meal, date = null, now = new Date() }) {
  const state = getState()
  const target = date || today(now)
  const source = lastMealBefore(meal, target)
  if (!source) return { ok: false, reason: 'Aucun repas de ce type enregistré avant cette date.' }

  let day = dayOf(state.nutrition.days, target)
  for (const entry of source.entries) {
    const copy = { ...entry, id: uid('nl'), at: now.toISOString(), meal }
    day = addEntry(day, copy)
    state.nutrition.usage = touchUsage(state.nutrition.usage, copy.foodId, {
      qty: copy.qty,
      unit: copy.unit,
      snapshot: copy.snapshot,
      now
    })
  }
  state.nutrition.days[target] = day
  await save()
  return { ok: true, added: source.entries.length, from: source.date }
}

export function updateLogEntry(date, entryId, patch) {
  const state = getState()
  state.nutrition.days[date] = updateEntry(dayOf(state.nutrition.days, date), entryId, patch)
  return save()
}

export function removeLogEntry(date, entryId) {
  const state = getState()
  const day = removeEntry(dayOf(state.nutrition.days, date), entryId)
  // Une journée vidée ne laisse pas de coquille dans le stockage.
  if (day.entries.length === 0 && !day.note) delete state.nutrition.days[date]
  else state.nutrition.days[date] = day
  return save()
}

/* ---------- mémoire ---------- */

export function toggleFavorite(id, snapshot = null) {
  const n = getState().nutrition
  const isFavorite = !!n.usage[id]?.favorite
  n.usage = setFavoriteIn(n.usage, id, !isFavorite, snapshot || resolveFood(id))
  return save().then(() => !isFavorite)
}
