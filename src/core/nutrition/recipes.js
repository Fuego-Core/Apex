/* RECETTES — ce que tu prépares toi-même, compté une fois pour toutes.

   Une recette est une liste d'ingrédients et un nombre de portions. APEX en
   déduit les valeurs d'UNE portion, et c'est cette portion qui s'ajoute au
   journal comme n'importe quel aliment : elle rentre donc dans les récents, et
   se ré-ajoute ensuite d'un seul geste.

   Deux principes, hérités du reste de la Phase 2 :

   1. Chaque ingrédient embarque son propre instantané. Une recette reste donc
      calculable si l'aliment d'origine est modifié, supprimé, ou si le cache
      disparaît. Modifier un aliment ne réécrit jamais une recette.
   2. Rien n'est deviné. Un ingrédient dont la quantité n'est pas convertible,
      ou dont les calories manquent, fait échouer la recette avec un message —
      il ne devient pas 0. */

import { slug } from '../catalog.js'
import { scale, sumMacros, MACROS } from './calculations.js'

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const recipeId = (key) => `recipe:${key}`
export const isRecipeId = (id) => typeof id === 'string' && id.startsWith('recipe:')

/**
 * Valeurs d'une recette, calculées depuis les instantanés de ses ingrédients.
 * @returns {{total, perServing, servings, unscalable: string[]}}
 */
export function recipeValues(recipe) {
  const unscalable = []
  const parts = (recipe?.items || []).map((item) => {
    const values = scale(item.snapshot, item.qty, item.unit)
    if (!values) unscalable.push(item.snapshot?.name || item.foodId)
    return values
  })

  const total = sumMacros(parts)
  const servings = Math.max(1, Math.round(num(recipe?.servings) || 1))
  const perServing = {}
  for (const macro of MACROS) {
    perServing[macro] = total[macro] === null ? null : total[macro] / servings
  }
  return { total, perServing, servings, unscalable }
}

/**
 * Une recette vue comme un aliment : une portion pour base.
 * C'est ce qui lui permet de traverser tout le reste de l'app — recherche,
 * ajout, mémoire, journal — sans qu'aucun de ces morceaux ait à la connaître.
 */
export function recipeAsFood(recipe) {
  const { perServing, servings } = recipeValues(recipe)
  return {
    id: recipe.id,
    source: 'recipe',
    name: recipe.name,
    brand: null,
    barcode: null,
    per: 1,
    unit: 'portion',
    servingSize: null,
    kcal: perServing.kcal,
    protein: perServing.protein,
    carbs: perServing.carbs,
    fat: perServing.fat,
    fiber: perServing.fiber,
    servings,
    // Ce qu'il y avait dedans, figé avec la ligne : une recette modifiée plus
    // tard ne change pas ce qu'on a mangé hier.
    ingredients: (recipe.items || []).map((i) => ({
      name: i.snapshot?.name || i.foodId,
      qty: i.qty,
      unit: i.unit || i.snapshot?.unit || 'g'
    }))
  }
}

/** Un ingrédient prêt à être stocké : la quantité, et l'instantané qui va avec. */
export function makeItem({ foodId, snapshot, qty, unit = null }) {
  return {
    foodId,
    qty: num(qty),
    unit: unit || snapshot?.unit || 'g',
    snapshot: snapshot || null
  }
}

/**
 * Contrôle d'une recette avant enregistrement.
 * @returns {{ok: boolean, errors: {champ: message}}}
 */
export function validateRecipeInput(input) {
  const errors = {}
  const name = String(input?.name ?? '').trim()
  if (!name) errors.name = 'Donne un nom à la recette.'
  else if (name.length > 80) errors.name = '80 caractères maximum.'

  const servings = num(input?.servings)
  if (servings === null || servings < 1) errors.servings = 'Au moins une portion.'
  else if (servings > 50) errors.servings = '50 portions maximum.'
  else if (Math.round(servings) !== servings) errors.servings = 'Un nombre entier de portions.'

  const items = Array.isArray(input?.items) ? input.items : []
  if (!items.length) errors.items = 'Ajoute au moins un ingrédient.'
  else {
    const badQty = items.find((i) => num(i.qty) === null || num(i.qty) <= 0)
    if (badQty) errors.items = `« ${badQty.snapshot?.name || 'Un ingrédient'} » : quantité manquante.`
    else {
      const noEnergy = items.find((i) => num(i.snapshot?.kcal) === null)
      if (noEnergy) errors.items = `« ${noEnergy.snapshot?.name || 'Un ingrédient'} » : calories inconnues. APEX ne les invente pas.`
      else {
        const { unscalable } = recipeValues({ ...input, items })
        if (unscalable.length) errors.items = `« ${unscalable[0]} » : quantité incompatible avec son unité.`
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/** Fabrique une recette. Aucune valeur n'est retouchée au passage. */
export function makeRecipe(input, { now = new Date(), existing = [] } = {}) {
  const name = String(input.name).trim()
  const base = slug(name) || 'recette'
  const taken = new Set(existing.map((r) => r.id))
  let key = base
  let n = 2
  while (taken.has(recipeId(key))) key = `${base}-${n++}`

  return {
    id: recipeId(key),
    name,
    servings: Math.round(num(input.servings) || 1),
    items: (input.items || []).map(makeItem),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
}

/** Recettes classées pour l'affichage : les plus récemment modifiées d'abord. */
export function sortedRecipes(recipes) {
  return [...(recipes || [])].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}
