/* Aliments et mémoire alimentaire.

   Le comportement à protéger : la mémoire est autosuffisante. Récents et
   favoris doivent s'afficher et se ré-ajouter sans catalogue, sans cache,
   sans réseau. */

import { describe, it, expect } from 'vitest'
import {
  foodId,
  sourceOf,
  tokensOf,
  queryTokens,
  snapshotOf,
  validateFoodInput,
  makeUserFood,
  emptyUsage,
  touchUsage,
  setFavorite,
  recents,
  favorites,
  searchLocal
} from '../src/core/nutrition/foods.js'

const skyr = {
  id: 'user:skyr',
  source: 'user-created',
  name: 'Skyr nature',
  brand: 'Danone',
  per: 100,
  unit: 'g',
  servingSize: 150,
  kcal: 62,
  protein: 10,
  carbs: 4,
  fat: 0.2,
  fiber: 0
}

describe('identité', () => {
  it('préfixe l’id par la provenance', () => {
    expect(foodId('open-food-facts', '3033710065967')).toBe('off:3033710065967')
    expect(foodId('user-created', 'skyr-maison')).toBe('user:skyr-maison')
    expect(foodId('imported', 'abc')).toBe('imported:abc')
  })

  it('retrouve la provenance depuis l’id seul', () => {
    expect(sourceOf('off:123')).toBe('open-food-facts')
    expect(sourceOf('user:x')).toBe('user-created')
    expect(sourceOf('nimportequoi')).toBeNull()
  })

  it('fabrique un id lisible et évite les collisions', () => {
    const first = makeUserFood({ name: 'Skyr maison', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    expect(first.id).toBe('user:skyr-maison')
    const second = makeUserFood(
      { name: 'Skyr maison', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 },
      { existing: { 'user:skyr-maison': first } }
    )
    expect(second.id).toBe('user:skyr-maison-2')
  })

  it('conserve les valeurs saisies sans les retoucher', () => {
    const food = makeUserFood({ name: 'Test', per: 30, kcal: 111, protein: 24, carbs: 1.5, fat: 1, fiber: '' })
    expect(food.per).toBe(30)
    expect(food.kcal).toBe(111)
    expect(food.fiber).toBeNull()
  })
})

describe('jetons de recherche', () => {
  it('normalise accents, casse et ponctuation', () => {
    expect(tokensOf('Blanc de Poulet, rôti')).toEqual(['blanc', 'de', 'poulet', 'roti'])
  })

  it('écarte les mots d’une lettre et les doublons à l’indexation', () => {
    expect(tokensOf('A B riz riz')).toEqual(['riz'])
  })

  it('garde une lettre unique côté recherche : on filtre dès la frappe', () => {
    expect(queryTokens('s')).toEqual(['s'])
    expect(queryTokens('  ')).toEqual([])
  })
})

describe('validation d’un aliment saisi', () => {
  it('accepte une fiche complète', () => {
    expect(validateFoodInput(skyr).ok).toBe(true)
  })

  it('exige un nom et une base de référence', () => {
    const { errors } = validateFoodInput({ ...skyr, name: '  ', per: 0 })
    expect(errors.name).toBeTruthy()
    expect(errors.per).toBeTruthy()
  })

  it('refuse une densité calorique impossible', () => {
    const { errors } = validateFoodInput({ ...skyr, kcal: 2000 })
    expect(errors.kcal).toMatch(/950 kcal/)
  })

  it('refuse une macro supérieure au poids total', () => {
    const { errors } = validateFoodInput({ ...skyr, protein: 150 })
    expect(errors.protein).toBeTruthy()
  })

  it('refuse une somme de macros incohérente', () => {
    const { errors } = validateFoodInput({ ...skyr, protein: 50, carbs: 50, fat: 20 })
    expect(errors.protein).toMatch(/dépassent/)
  })

  it('accepte des fibres non renseignées', () => {
    expect(validateFoodInput({ ...skyr, fiber: '' }).ok).toBe(true)
    expect(validateFoodInput({ ...skyr, fiber: null }).ok).toBe(true)
  })

  it('exige les macros plutôt que de les supposer nulles', () => {
    const { errors } = validateFoodInput({ ...skyr, carbs: null })
    expect(errors.carbs).toBeTruthy()
  })
})

describe('instantané', () => {
  it('emporte tout ce qu’il faut pour recalculer sans le catalogue', () => {
    const snap = snapshotOf(skyr)
    expect(snap).toMatchObject({ name: 'Skyr nature', per: 100, unit: 'g', kcal: 62, protein: 10 })
    expect(snap.source).toBe('user-created')
  })

  it('garde une macro absente à null', () => {
    expect(snapshotOf({ ...skyr, fiber: undefined }).fiber).toBeNull()
  })
})

describe('mémoire d’usage', () => {
  const now = new Date('2026-08-15T12:00:00.000Z')

  it('retient la quantité utilisée — c’est elle qui permet le geste unique', () => {
    const usage = touchUsage({}, 'user:skyr', { qty: 250, unit: 'g', snapshot: snapshotOf(skyr), now })
    expect(usage['user:skyr'].lastQty).toBe(250)
    expect(usage['user:skyr'].count).toBe(1)
  })

  it('compte les utilisations successives', () => {
    let usage = touchUsage({}, 'off:1', { qty: 100, snapshot: snapshotOf(skyr), now })
    usage = touchUsage(usage, 'off:1', { qty: 150, snapshot: snapshotOf(skyr), now })
    expect(usage['off:1'].count).toBe(2)
    expect(usage['off:1'].lastQty).toBe(150)
  })

  it('garde l’instantané le plus récent', () => {
    let usage = touchUsage({}, 'off:1', { qty: 100, snapshot: { ...snapshotOf(skyr), kcal: 60 }, now })
    usage = touchUsage(usage, 'off:1', { qty: 100, snapshot: { ...snapshotOf(skyr), kcal: 64 }, now })
    expect(usage['off:1'].snapshot.kcal).toBe(64)
  })

  it('bascule un favori sans perdre le reste', () => {
    const usage = setFavorite(touchUsage({}, 'user:skyr', { qty: 250, snapshot: snapshotOf(skyr), now }), 'user:skyr', true)
    expect(usage['user:skyr'].favorite).toBe(true)
    expect(usage['user:skyr'].lastQty).toBe(250)
  })

  it('démarre une entrée vierge proprement', () => {
    expect(emptyUsage()).toEqual({ count: 0, lastAt: null, lastQty: null, unit: null, favorite: false, snapshot: null })
  })
})

describe('récents et favoris', () => {
  const snap = snapshotOf(skyr)
  const usage = {
    'user:skyr': { count: 12, lastAt: '2026-08-15T08:00:00.000Z', lastQty: 250, unit: 'g', favorite: true, snapshot: snap },
    'off:riz': { count: 30, lastAt: '2026-08-14T12:00:00.000Z', lastQty: 100, unit: 'g', favorite: true, snapshot: { ...snap, name: 'Riz' } },
    'off:banane': { count: 2, lastAt: '2026-08-15T09:00:00.000Z', lastQty: 120, unit: 'g', favorite: false, snapshot: { ...snap, name: 'Banane' } },
    'off:jamais': { count: 0, lastAt: null, lastQty: null, unit: null, favorite: false, snapshot: null }
  }

  it('classe les récents du plus récent au plus ancien', () => {
    expect(recents(usage).map((r) => r.name)).toEqual(['Banane', 'Skyr nature', 'Riz'])
  })

  it('rend la dernière quantité utilisée avec chaque récent', () => {
    expect(recents(usage)[1]).toMatchObject({ name: 'Skyr nature', lastQty: 250, unit: 'g' })
  })

  it('écarte ce dont la mémoire ne sait rien', () => {
    expect(recents(usage).some((r) => r.id === 'off:jamais')).toBe(false)
  })

  it('classe les favoris par fréquence', () => {
    expect(favorites(usage).map((r) => r.name)).toEqual(['Riz', 'Skyr nature'])
  })

  it('fonctionne sans aucun aliment personnel ni cache', () => {
    // Aucun catalogue fourni : la mémoire se suffit à elle-même.
    expect(recents(usage)).toHaveLength(3)
    expect(favorites(usage)).toHaveLength(2)
  })
})

describe('recherche locale', () => {
  const foods = { 'user:skyr': skyr }
  const usage = {
    'off:poulet': { count: 5, lastAt: '2026-08-14T12:00:00.000Z', lastQty: 150, unit: 'g', favorite: false, snapshot: { name: 'Blanc de poulet', brand: 'Le Gaulois', per: 100, unit: 'g', kcal: 110, protein: 23, carbs: 0, fat: 1.5, fiber: null } },
    'off:skyr-vanille': { count: 9, lastAt: '2026-08-13T12:00:00.000Z', lastQty: 150, unit: 'g', favorite: true, snapshot: { name: 'Skyr vanille', brand: 'Isey', per: 100, unit: 'g', kcal: 70, protein: 9, carbs: 8, fat: 0.2, fiber: null } }
  }

  it('trouve par début de mot, sans accents ni casse', () => {
    expect(searchLocal({ foods, usage }, 'sky').map((r) => r.name).sort()).toEqual(['Skyr nature', 'Skyr vanille'])
  })

  it('cherche aussi dans la marque', () => {
    expect(searchLocal({ foods, usage }, 'gaulois').map((r) => r.name)).toEqual(['Blanc de poulet'])
  })

  it('exige que tous les mots correspondent', () => {
    expect(searchLocal({ foods, usage }, 'skyr vanille').map((r) => r.name)).toEqual(['Skyr vanille'])
    expect(searchLocal({ foods, usage }, 'skyr introuvable')).toEqual([])
  })

  it('filtre dès la première lettre', () => {
    expect(searchLocal({ foods, usage }, 's').map((r) => r.name).sort()).toEqual(['Skyr nature', 'Skyr vanille'])
  })

  it('remonte les favoris puis les plus utilisés', () => {
    expect(searchLocal({ foods, usage }, 's')[0].name).toBe('Skyr vanille')
  })

  it('ne rend rien sur une recherche vide', () => {
    expect(searchLocal({ foods, usage }, '   ')).toEqual([])
  })

  it('trouve un aliment personnel jamais encore utilisé', () => {
    expect(searchLocal({ foods: { 'user:skyr': skyr }, usage: {} }, 'skyr').map((r) => r.id)).toEqual(['user:skyr'])
  })
})
