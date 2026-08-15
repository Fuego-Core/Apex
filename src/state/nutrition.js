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
  validateFoodInput
} from '../core/nutrition/foods.js'
import { dayOf, addEntry, updateEntry, removeEntry, suggestedMeal } from '../core/nutrition/journal.js'
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
  const remembered = n.usage[id]?.snapshot
  return remembered ? { ...remembered, id } : null
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
