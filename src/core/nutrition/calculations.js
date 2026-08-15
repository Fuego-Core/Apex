/* CALCULS NUTRITIONNELS — purs, sans DOM, sans stockage.

   Deux règles qui gouvernent tout ce fichier :

   1. Une valeur absente n'est pas zéro. Si un aliment n'a pas de fibres
      renseignées, le total ne fait pas comme si c'était 0 g : il compte ce
      qu'il sait et dit combien d'aliments n'avaient pas la donnée.
   2. On n'arrondit jamais dans le stockage, seulement à l'affichage. Arrondir
      chaque ligne puis additionner fait dériver un total de plusieurs kcal. */

export const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber']

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Arrondi d'affichage : 1 décimale pour les macros, entier pour les calories. */
export function display(value, macro = 'protein') {
  if (value === null || value === undefined) return null
  return macro === 'kcal' ? Math.round(value) : Math.round(value * 10) / 10
}

/**
 * Facteur d'échelle entre la base de référence d'un aliment et une quantité.
 * @returns {number|null} null si la conversion n'a pas de sens (unités
 *          incompatibles, portion inconnue) — auquel cas on ne devine pas.
 */
export function factorFor(food, qty, unit = null) {
  const quantity = num(qty)
  const per = num(food?.per)
  if (quantity === null || quantity < 0 || per === null || per <= 0) return null

  const wanted = unit || food.unit || 'g'
  const base = food.unit || 'g'

  if (wanted === base) return quantity / per

  if (wanted === 'portion') {
    const serving = num(food.servingSize)
    // Pas de portion renseignée : on refuse plutôt que d'inventer 100 g.
    if (serving === null || serving <= 0) return null
    return (quantity * serving) / per
  }

  // g et ml ne sont pas interchangeables sans densité : on ne convertit pas.
  return null
}

/**
 * Valeurs nutritionnelles d'une quantité d'un aliment.
 * @returns {{kcal, protein, carbs, fat, fiber}|null} chaque macro absente à la
 *          source reste null. null total si la quantité n'est pas calculable.
 */
export function scale(food, qty, unit = null) {
  const factor = factorFor(food, qty, unit)
  if (factor === null) return null

  const out = {}
  for (const macro of MACROS) {
    const value = num(food[macro])
    out[macro] = value === null ? null : value * factor
  }
  return out
}

/** Valeurs d'une ligne de journal : elles viennent de son instantané, jamais
 *  du catalogue — une journée passée ne doit pas bouger si la source change. */
export function entryMacros(entry) {
  if (!entry?.snapshot) return null
  return scale(entry.snapshot, entry.qty, entry.unit)
}

/**
 * Somme d'une liste de valeurs nutritionnelles.
 * @returns {{kcal, protein, carbs, fat, fiber, missing: {macro: nombre}}}
 *          Une macro que personne ne renseignait vaut null, pas 0.
 */
export function sumMacros(list) {
  const totals = {}
  const missing = {}
  const seen = {}
  for (const macro of MACROS) {
    totals[macro] = 0
    missing[macro] = 0
    seen[macro] = 0
  }

  for (const values of list) {
    if (!values) continue
    for (const macro of MACROS) {
      const v = num(values[macro])
      if (v === null) missing[macro]++
      else {
        totals[macro] += v
        seen[macro]++
      }
    }
  }

  const out = { missing: {} }
  for (const macro of MACROS) {
    out[macro] = seen[macro] ? totals[macro] : null
    if (missing[macro]) out.missing[macro] = missing[macro]
  }
  return out
}

/** Total d'un ensemble de lignes de journal. */
export function totalsOf(entries) {
  return sumMacros((entries || []).map(entryMacros))
}

/**
 * Totaux d'une journée, global et par repas.
 * @returns {{total, byMeal: {repas: total}, entryCount}}
 */
export function dayTotals(day) {
  const entries = day?.entries || []
  const byMeal = {}
  for (const entry of entries) {
    ;(byMeal[entry.meal] = byMeal[entry.meal] || []).push(entry)
  }
  return {
    total: totalsOf(entries),
    byMeal: Object.fromEntries(Object.entries(byMeal).map(([meal, list]) => [meal, totalsOf(list)])),
    entryCount: entries.length
  }
}

/**
 * Une valeur par journée enregistrée, du plus ancien au plus récent.
 * Les journées sans donnée exploitable sont absentes — pas à zéro : ne rien
 * avoir mangé et ne rien avoir noté ne sont pas la même chose.
 * @returns {{date: string, value: number}[]}
 */
export function dailySeries(days, macro = 'kcal') {
  return Object.values(days || {})
    .filter((day) => day?.entries?.length)
    .map((day) => ({ date: day.date, value: totalsOf(day.entries)[macro] }))
    .filter((point) => point.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Valeurs d'une recette, au total et par portion.
 * @param {Function} resolveFood id -> aliment, ou null si introuvable.
 * @returns {{total, perServing, servings, unresolved: string[]}}
 */
export function recipeTotals(recipe, resolveFood) {
  const unresolved = []
  const parts = (recipe?.items || []).map((item) => {
    const food = resolveFood(item.foodId)
    if (!food) {
      unresolved.push(item.foodId)
      return null
    }
    return scale(food, item.qty, item.unit)
  })

  const total = sumMacros(parts)
  const servings = Math.max(1, Math.round(num(recipe?.servings) || 1))
  const perServing = {}
  for (const macro of MACROS) {
    perServing[macro] = total[macro] === null ? null : total[macro] / servings
  }
  return { total, perServing, servings, unresolved }
}

/** Total d'un repas enregistré (modèle réutilisable, pas une ligne de journal). */
export function mealTotals(meal, resolveFood) {
  const unresolved = []
  const parts = (meal?.items || []).map((item) => {
    const food = resolveFood(item.foodId)
    if (!food) {
      unresolved.push(item.foodId)
      return null
    }
    return scale(food, item.qty, item.unit)
  })
  return { total: sumMacros(parts), unresolved }
}

/**
 * Ce qu'il reste par rapport aux cibles.
 * @returns {{macro: {target, eaten, left, pct}}|null} null si aucune cible :
 *          sans objectif, APEX compte mais ne juge pas.
 */
export function remaining(targets, totals) {
  if (!targets || targets.mode === null) return null
  const out = {}
  for (const macro of MACROS) {
    const target = num(targets[macro])
    if (target === null) continue
    const eaten = num(totals?.[macro]) ?? 0
    out[macro] = {
      target,
      eaten,
      left: target - eaten,
      pct: target > 0 ? Math.min(999, Math.round((eaten / target) * 100)) : null
    }
  }
  return Object.keys(out).length ? out : null
}

/** Cohérence : les macros expliquent-elles les calories annoncées ?
 *  4 kcal/g pour protéines et glucides, 9 pour les lipides. Sert à repérer une
 *  fiche douteuse, jamais à corriger la valeur de la source en douce. */
export function energyFromMacros(values) {
  const p = num(values?.protein)
  const c = num(values?.carbs)
  const f = num(values?.fat)
  if (p === null || c === null || f === null) return null
  return p * 4 + c * 4 + f * 9
}

/** Écart relatif entre calories annoncées et calories calculées (0.1 = 10 %). */
export function energyMismatch(values) {
  const declared = num(values?.kcal)
  const computed = energyFromMacros(values)
  if (declared === null || computed === null || declared <= 0) return null
  return Math.abs(declared - computed) / declared
}
