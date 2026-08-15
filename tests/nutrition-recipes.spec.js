/* RECETTES — ce qu'on prépare soi-même.

   Le comportement protégé ici : une recette est autosuffisante. Ses ingrédients
   portent leurs instantanés, donc modifier ou supprimer un aliment ne la
   change pas ; et une portion déjà mangée ne change pas non plus quand la
   recette évolue. */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  recipeValues,
  recipeAsFood,
  makeRecipe,
  makeItem,
  validateRecipeInput,
  isRecipeId,
  sortedRecipes
} from '../src/core/nutrition/recipes.js'
import { dayTotals } from '../src/core/nutrition/calculations.js'
import { MemoryStorage } from './helpers/storage.js'

const riz = { name: 'Riz cru', brand: null, source: 'user-created', per: 100, unit: 'g', kcal: 350, protein: 7, carbs: 78, fat: 0.6, fiber: 1 }
const poulet = { name: 'Blanc de poulet', brand: null, source: 'user-created', per: 100, unit: 'g', kcal: 110, protein: 23, carbs: 0, fat: 1.5, fiber: null }

const plat = {
  id: 'recipe:poulet-riz',
  name: 'Poulet riz',
  servings: 4,
  items: [
    { foodId: 'user:riz', qty: 300, unit: 'g', snapshot: riz },
    { foodId: 'user:poulet', qty: 600, unit: 'g', snapshot: poulet }
  ]
}

describe('valeurs d’une recette', () => {
  it('additionne les ingrédients et divise par les portions', () => {
    const { total, perServing, servings } = recipeValues(plat)
    // 300 g de riz = 1050 kcal ; 600 g de poulet = 660 kcal.
    expect(total.kcal).toBeCloseTo(1710, 6)
    expect(servings).toBe(4)
    expect(perServing.kcal).toBeCloseTo(427.5, 6)
    expect(perServing.protein).toBeCloseTo(39.75, 6)
  })

  it('ne compte pas une macro que personne ne renseigne', () => {
    const sansFibres = { ...plat, items: [{ foodId: 'user:poulet', qty: 100, unit: 'g', snapshot: poulet }] }
    expect(recipeValues(sansFibres).perServing.fiber).toBeNull()
  })

  it('signale un ingrédient dont la quantité n’est pas convertible', () => {
    const bancal = { ...plat, items: [{ foodId: 'user:riz', qty: 2, unit: 'portion', snapshot: riz }] }
    expect(recipeValues(bancal).unscalable).toEqual(['Riz cru'])
  })

  it('refuse zéro portion plutôt que de diviser par rien', () => {
    expect(recipeValues({ ...plat, servings: 0 }).servings).toBe(1)
  })
})

describe('une recette vue comme un aliment', () => {
  it('a une portion pour base', () => {
    const food = recipeAsFood(plat)
    expect(food).toMatchObject({ id: 'recipe:poulet-riz', source: 'recipe', per: 1, unit: 'portion' })
    expect(food.kcal).toBeCloseTo(427.5, 6)
  })

  it('emporte sa composition', () => {
    expect(recipeAsFood(plat).ingredients).toEqual([
      { name: 'Riz cru', qty: 300, unit: 'g' },
      { name: 'Blanc de poulet', qty: 600, unit: 'g' }
    ])
  })

  it('se reconnaît à son identifiant', () => {
    expect(isRecipeId('recipe:x')).toBe(true)
    expect(isRecipeId('user:x')).toBe(false)
  })
})

describe('validation', () => {
  const valid = { name: 'Poulet riz', servings: 4, items: plat.items }

  it('accepte une recette complète', () => {
    expect(validateRecipeInput(valid).ok).toBe(true)
  })

  it('exige un nom, des portions entières et des ingrédients', () => {
    expect(validateRecipeInput({ ...valid, name: ' ' }).errors.name).toBeTruthy()
    expect(validateRecipeInput({ ...valid, servings: 2.5 }).errors.servings).toMatch(/entier/)
    expect(validateRecipeInput({ ...valid, servings: 0 }).errors.servings).toBeTruthy()
    expect(validateRecipeInput({ ...valid, items: [] }).errors.items).toBeTruthy()
  })

  it('refuse un ingrédient sans calories plutôt que de compter 0', () => {
    const sansKcal = { ...valid, items: [{ foodId: 'x', qty: 100, unit: 'g', snapshot: { ...riz, kcal: null } }] }
    expect(validateRecipeInput(sansKcal).errors.items).toMatch(/invente/)
  })

  it('refuse une quantité manquante', () => {
    const sansQty = { ...valid, items: [{ foodId: 'x', qty: null, unit: 'g', snapshot: riz }] }
    expect(validateRecipeInput(sansQty).errors.items).toMatch(/quantité manquante/)
  })

  it('évite les collisions d’identifiants', () => {
    const first = makeRecipe(valid)
    const second = makeRecipe(valid, { existing: [first] })
    expect(first.id).toBe('recipe:poulet-riz')
    expect(second.id).toBe('recipe:poulet-riz-2')
  })

  it('classe les recettes de la plus récemment modifiée à la plus ancienne', () => {
    const a = { id: 'recipe:a', updatedAt: '2026-08-01T00:00:00.000Z' }
    const b = { id: 'recipe:b', updatedAt: '2026-08-10T00:00:00.000Z' }
    expect(sortedRecipes([a, b]).map((r) => r.id)).toEqual(['recipe:b', 'recipe:a'])
  })

  it('normalise un ingrédient sans écraser son unité', () => {
    expect(makeItem({ foodId: 'x', snapshot: riz, qty: '250' })).toEqual({ foodId: 'x', qty: 250, unit: 'g', snapshot: riz })
  })
})

describe('recettes sur l’état', () => {
  let mod

  beforeEach(async () => {
    vi.resetModules()
    mod = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await mod.initState(createDataStore(createLocalAdapter(new MemoryStorage())))
  })

  const createPlat = () => mod.createRecipe({ name: 'Poulet riz', servings: 4, items: plat.items })

  it('crée une recette et la rend résoluble comme un aliment', async () => {
    const res = await createPlat()
    expect(res.ok).toBe(true)
    const food = mod.resolveFood(res.recipe.id)
    expect(food.unit).toBe('portion')
    expect(food.kcal).toBeCloseTo(427.5, 6)
  })

  it('refuse une recette invalide sans rien enregistrer', async () => {
    const res = await mod.createRecipe({ name: '', servings: 4, items: plat.items })
    expect(res.ok).toBe(false)
    expect(mod.getState().nutrition.recipes).toHaveLength(0)
  })

  it('enregistre une portion au journal comme un aliment ordinaire', async () => {
    const { recipe } = await createPlat()
    const food = mod.resolveFood(recipe.id)
    const res = await mod.logFood({ foodId: recipe.id, snapshot: food, qty: 2, unit: 'portion', date: '2026-08-15' })
    expect(res.ok).toBe(true)

    const day = mod.getState().nutrition.days['2026-08-15']
    expect(dayTotals(day).total.kcal).toBeCloseTo(855, 6)
    expect(day.entries[0].snapshot.ingredients).toHaveLength(2)
  })

  it('laisse intacte une portion déjà mangée quand la recette change', async () => {
    const { recipe } = await createPlat()
    await mod.logFood({ foodId: recipe.id, snapshot: mod.resolveFood(recipe.id), qty: 1, unit: 'portion', date: '2026-08-15' })

    await mod.updateRecipe(recipe.id, { servings: 8 })
    const day = mod.getState().nutrition.days['2026-08-15']
    expect(dayTotals(day).total.kcal).toBeCloseTo(427.5, 6)
    expect(mod.resolveFood(recipe.id).kcal).toBeCloseTo(213.75, 6)
  })

  it('laisse intacte une portion déjà mangée quand la recette est supprimée', async () => {
    const { recipe } = await createPlat()
    await mod.logFood({ foodId: recipe.id, snapshot: mod.resolveFood(recipe.id), qty: 1, unit: 'portion', date: '2026-08-15' })
    await mod.removeRecipe(recipe.id)

    expect(mod.getState().nutrition.recipes).toHaveLength(0)
    expect(dayTotals(mod.getState().nutrition.days['2026-08-15']).total.kcal).toBeCloseTo(427.5, 6)
  })

  it('ne dépend plus de l’aliment d’origine une fois créée', async () => {
    const { food } = await mod.createFood({ name: 'Riz', per: 100, kcal: 350, protein: 7, carbs: 78, fat: 0.6 })
    const { recipe } = await mod.createRecipe({
      name: 'Riz nature',
      servings: 2,
      items: [{ foodId: food.id, qty: 200, unit: 'g', snapshot: mod.resolveFood(food.id) }]
    })
    await mod.removeFood(food.id)
    expect(mod.resolveFood(recipe.id).kcal).toBeCloseTo(350, 6)
  })

  it('revient dans les récents et se ré-ajoute d’un geste', async () => {
    const { recipe } = await createPlat()
    await mod.logFood({ foodId: recipe.id, snapshot: mod.resolveFood(recipe.id), qty: 2, unit: 'portion', date: '2026-08-15' })
    const { recents } = await import('../src/core/nutrition/foods.js')
    expect(recents(mod.getState().nutrition.usage)[0]).toMatchObject({ name: 'Poulet riz', lastQty: 2, unit: 'portion' })
  })

  it('emporte les recettes dans l’export', async () => {
    await createPlat()
    expect(JSON.parse(mod.exportJSON()).nutrition.recipes).toHaveLength(1)
  })
})

describe('refaire un repas', () => {
  let mod

  beforeEach(async () => {
    vi.resetModules()
    mod = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await mod.initState(createDataStore(createLocalAdapter(new MemoryStorage())))

    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 200, meal: 'petit-dejeuner', date: '2026-08-13' })
    await mod.logFood({ foodId: food.id, qty: 100, meal: 'diner', date: '2026-08-14' })
  })

  it('retrouve le dernier repas de ce type', () => {
    expect(mod.lastMealBefore('petit-dejeuner', '2026-08-15').date).toBe('2026-08-13')
    expect(mod.lastMealBefore('collation', '2026-08-15')).toBeNull()
  })

  it('recopie les lignes avec leurs instantanés', async () => {
    const res = await mod.repeatMeal({ meal: 'petit-dejeuner', date: '2026-08-15' })
    expect(res).toMatchObject({ ok: true, added: 1, from: '2026-08-13' })

    const day = mod.getState().nutrition.days['2026-08-15']
    expect(day.entries[0].qty).toBe(200)
    expect(day.entries[0].snapshot.kcal).toBe(62)
    // Des lignes distinctes : supprimer l'une ne touche pas l'autre.
    expect(day.entries[0].id).not.toBe(mod.getState().nutrition.days['2026-08-13'].entries[0].id)
  })

  it('ne touche pas au jour d’origine', async () => {
    await mod.repeatMeal({ meal: 'petit-dejeuner', date: '2026-08-15' })
    expect(mod.getState().nutrition.days['2026-08-13'].entries).toHaveLength(1)
  })

  it('refuse proprement quand il n’y a rien à refaire', async () => {
    const res = await mod.repeatMeal({ meal: 'collation', date: '2026-08-15' })
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/Aucun repas/)
    expect(mod.getState().nutrition.days['2026-08-15']).toBeUndefined()
  })

  it('ne remonte jamais le temps à l’envers', async () => {
    // Depuis le 14, le petit-déjeuner du 13 est le bon ; le dîner du 14 ne
    // doit pas servir de source pour le 14 lui-même.
    expect(mod.lastMealBefore('diner', '2026-08-14')).toBeNull()
  })
})
