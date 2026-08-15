/* Calculs nutritionnels. Ce qui est vérifié ici autant que les additions :
   qu'une donnée absente ne devienne jamais un zéro. */

import { describe, it, expect } from 'vitest'
import {
  factorFor,
  scale,
  entryMacros,
  sumMacros,
  totalsOf,
  dayTotals,
  recipeTotals,
  mealTotals,
  remaining,
  energyFromMacros,
  energyMismatch,
  display
} from '../src/core/nutrition/calculations.js'

/** Skyr : 100 g de référence, portion de 150 g. */
const skyr = { id: 'user:skyr', name: 'Skyr', per: 100, unit: 'g', servingSize: 150, kcal: 62, protein: 10, carbs: 4, fat: 0.2, fiber: 0 }
/** Avoine : les fibres sont renseignées. */
const avoine = { id: 'user:avoine', name: 'Avoine', per: 100, unit: 'g', kcal: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 }
/** Poulet : pas de fibres du tout dans la fiche. */
const poulet = { id: 'off:1', name: 'Poulet', per: 100, unit: 'g', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: null }

const entry = (food, qty, meal = 'dejeuner', unit = null) => ({
  id: `ne_${food.id}_${qty}`,
  meal,
  foodId: food.id,
  qty,
  unit: unit || food.unit,
  at: '2026-08-15T12:00:00.000Z',
  snapshot: { ...food }
})

describe('facteur d’échelle', () => {
  it('rapporte la quantité à la base de l’aliment', () => {
    expect(factorFor(skyr, 250)).toBe(2.5)
    expect(factorFor(skyr, 100)).toBe(1)
    expect(factorFor(skyr, 0)).toBe(0)
  })

  it('gère les portions quand la fiche en donne une', () => {
    expect(factorFor(skyr, 2, 'portion')).toBe(3) // 2 × 150 g / 100 g
  })

  it('refuse une portion inconnue au lieu d’en inventer une', () => {
    expect(factorFor(avoine, 1, 'portion')).toBeNull()
  })

  it('refuse de convertir des grammes en millilitres', () => {
    expect(factorFor(skyr, 100, 'ml')).toBeNull()
  })

  it('refuse une quantité absurde ou absente', () => {
    expect(factorFor(skyr, -50)).toBeNull()
    expect(factorFor(skyr, null)).toBeNull()
    expect(factorFor({ per: 0 }, 100)).toBeNull()
  })
})

describe('mise à l’échelle', () => {
  it('calcule les macros d’une quantité', () => {
    const v = scale(skyr, 250)
    expect(v.kcal).toBe(155)
    expect(v.protein).toBe(25)
    expect(v.carbs).toBe(10)
    expect(v.fat).toBeCloseTo(0.5, 5)
  })

  it('laisse à null une macro absente de la source', () => {
    expect(scale(poulet, 200).fiber).toBeNull()
  })

  it('ne rend rien quand la quantité n’est pas calculable', () => {
    expect(scale(skyr, 'beaucoup')).toBeNull()
  })

  it('n’arrondit pas : c’est l’affichage qui arrondit', () => {
    expect(scale(avoine, 37).kcal).toBeCloseTo(140.6, 5)
    expect(display(scale(avoine, 37).kcal, 'kcal')).toBe(141)
  })
})

describe('lignes de journal', () => {
  it('lit l’instantané, pas le catalogue', () => {
    const line = entry(skyr, 250)
    line.snapshot.kcal = 100 // la fiche a changé depuis, la ligne ne bouge pas
    expect(entryMacros(line).kcal).toBe(250)
  })

  it('ne rend rien sans instantané', () => {
    expect(entryMacros({ qty: 100, unit: 'g' })).toBeNull()
  })
})

describe('sommes', () => {
  it('additionne ce qui est connu', () => {
    const t = sumMacros([scale(skyr, 200), scale(avoine, 50)])
    expect(t.kcal).toBe(124 + 190)
    expect(t.protein).toBeCloseTo(20 + 6.5, 5)
  })

  it('compte les aliments sans donnée au lieu de les traiter comme zéro', () => {
    const t = sumMacros([scale(avoine, 100), scale(poulet, 100)])
    expect(t.fiber).toBe(10) // et non 10 + 0
    expect(t.missing.fiber).toBe(1)
  })

  it('rend null une macro que personne ne renseigne', () => {
    const t = sumMacros([scale(poulet, 100), scale(poulet, 150)])
    expect(t.fiber).toBeNull()
    expect(t.missing.fiber).toBe(2)
  })

  it('rend une somme vide sur une liste vide', () => {
    const t = sumMacros([])
    expect(t.kcal).toBeNull()
    expect(t.missing).toEqual({})
  })
})

describe('journée', () => {
  const day = {
    date: '2026-08-15',
    entries: [
      entry(skyr, 250, 'petit-dejeuner'),
      entry(avoine, 60, 'petit-dejeuner'),
      entry(poulet, 200, 'dejeuner')
    ]
  }

  it('totalise la journée', () => {
    const { total } = dayTotals(day)
    expect(total.kcal).toBeCloseTo(155 + 228 + 330, 5)
    expect(total.protein).toBeCloseTo(25 + 7.8 + 62, 5)
  })

  it('totalise chaque repas', () => {
    const { byMeal } = dayTotals(day)
    expect(byMeal['petit-dejeuner'].kcal).toBeCloseTo(383, 5)
    expect(byMeal['dejeuner'].kcal).toBe(330)
    expect(byMeal['diner']).toBeUndefined()
  })

  it('gère une journée vide sans inventer de zéros', () => {
    const { total, entryCount } = dayTotals({ date: '2026-08-16', entries: [] })
    expect(entryCount).toBe(0)
    expect(total.kcal).toBeNull()
  })
})

describe('recettes', () => {
  const resolve = (id) => [skyr, avoine, poulet].find((f) => f.id === id) || null
  const recipe = {
    id: 'r1',
    name: 'Bowl',
    servings: 4,
    items: [
      { foodId: 'off:1', qty: 500, unit: 'g' },
      { foodId: 'user:avoine', qty: 200, unit: 'g' }
    ]
  }

  it('calcule le total et la portion', () => {
    const r = recipeTotals(recipe, resolve)
    expect(r.total.kcal).toBe(165 * 5 + 380 * 2)
    expect(r.perServing.kcal).toBe((165 * 5 + 380 * 2) / 4)
    expect(r.servings).toBe(4)
  })

  it('signale un ingrédient introuvable au lieu de l’ignorer en silence', () => {
    const r = recipeTotals({ ...recipe, items: [...recipe.items, { foodId: 'off:disparu', qty: 100 }] }, resolve)
    expect(r.unresolved).toEqual(['off:disparu'])
  })

  it('ne divise jamais par zéro portion', () => {
    expect(recipeTotals({ ...recipe, servings: 0 }, resolve).servings).toBe(1)
  })

  it('totalise un repas enregistré', () => {
    const r = mealTotals({ items: [{ foodId: 'user:skyr', qty: 250, unit: 'g' }] }, resolve)
    expect(r.total.kcal).toBe(155)
    expect(r.unresolved).toEqual([])
  })
})

describe('reste à consommer', () => {
  const totals = { kcal: 1840, protein: 142, carbs: 190, fat: 52, fiber: null }

  it('compare aux cibles', () => {
    const r = remaining({ mode: 'manual', kcal: 2400, protein: 160 }, totals)
    expect(r.kcal.left).toBe(560)
    expect(r.kcal.pct).toBe(77)
    expect(r.protein.left).toBe(18)
  })

  it('ne rend rien tant qu’aucune cible n’est définie', () => {
    expect(remaining({ mode: null, kcal: null }, totals)).toBeNull()
    expect(remaining(null, totals)).toBeNull()
  })

  it('traite une journée vide comme zéro mangé, pas comme une absence de cible', () => {
    const r = remaining({ mode: 'manual', kcal: 2400 }, { kcal: null })
    expect(r.kcal.eaten).toBe(0)
    expect(r.kcal.left).toBe(2400)
  })
})

describe('cohérence énergétique', () => {
  it('calcule les calories à partir des macros', () => {
    expect(energyFromMacros({ protein: 10, carbs: 4, fat: 0.2 })).toBeCloseTo(57.8, 5)
  })

  it('mesure l’écart avec la valeur annoncée', () => {
    expect(energyMismatch(skyr)).toBeCloseTo(0.068, 2)
    expect(energyMismatch({ kcal: 100, protein: 25, carbs: 0, fat: 0 })).toBe(0)
  })

  it('repère un écart sur une fiche réelle', () => {
    // Poulet : 165 kcal annoncées, 31×4 + 3,6×9 = 156,4 calculées, soit ~5 %.
    expect(energyMismatch(poulet)).toBeCloseTo(0.052, 2)
  })

  it('ne conclut rien si une macro manque', () => {
    expect(energyMismatch({ kcal: 100 })).toBeNull()
    expect(energyMismatch({ kcal: 100, protein: 10, carbs: 5 })).toBeNull()
    expect(energyMismatch({ protein: 10, carbs: 5, fat: 1 })).toBeNull()
  })
})
