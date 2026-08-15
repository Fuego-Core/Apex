/* Journal alimentaire : jours, repas, lignes — et l'immuabilité du passé. */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MEALS,
  MEAL_LABELS,
  suggestedMeal,
  emptyDay,
  dayOf,
  addEntry,
  updateEntry,
  removeEntry,
  entriesOfMeal,
  usedMeals,
  loggedDays,
  shiftDate,
  loggedCount
} from '../src/core/nutrition/journal.js'
import { dayTotals } from '../src/core/nutrition/calculations.js'
import { MemoryStorage } from './helpers/storage.js'

const snapshot = { name: 'Skyr', brand: null, source: 'user-created', per: 100, unit: 'g', kcal: 62, protein: 10, carbs: 4, fat: 0.2, fiber: 0 }
const line = (id, meal, qty = 100) => ({ id, meal, foodId: 'user:skyr', qty, unit: 'g', at: '2026-08-15T12:00:00.000Z', snapshot })

describe('repas', () => {
  it('propose un repas selon l’heure, sans jamais l’imposer', () => {
    expect(suggestedMeal(new Date(2026, 7, 15, 8))).toBe('petit-dejeuner')
    expect(suggestedMeal(new Date(2026, 7, 15, 12, 30))).toBe('dejeuner')
    expect(suggestedMeal(new Date(2026, 7, 15, 16))).toBe('collation')
    expect(suggestedMeal(new Date(2026, 7, 15, 20))).toBe('diner')
  })

  it('nomme les quatre repas', () => {
    expect(MEALS).toHaveLength(4)
    expect(MEAL_LABELS['petit-dejeuner']).toBe('Petit-déjeuner')
  })
})

describe('journée', () => {
  it('rend une journée vide plutôt que rien', () => {
    expect(dayOf({}, '2026-08-15')).toEqual({ date: '2026-08-15', entries: [], note: '' })
  })

  it('ajoute, modifie et supprime une ligne sans muter l’original', () => {
    const day = emptyDay('2026-08-15')
    const withOne = addEntry(day, line('a', 'dejeuner'))
    expect(day.entries).toHaveLength(0)
    expect(withOne.entries).toHaveLength(1)

    const changed = updateEntry(withOne, 'a', { qty: 250 })
    expect(changed.entries[0].qty).toBe(250)
    expect(withOne.entries[0].qty).toBe(100)

    expect(removeEntry(changed, 'a').entries).toHaveLength(0)
  })

  it('regroupe par repas et n’affiche que les repas utilisés', () => {
    const day = addEntry(addEntry(emptyDay(), line('a', 'dejeuner')), line('b', 'petit-dejeuner'))
    expect(entriesOfMeal(day, 'dejeuner')).toHaveLength(1)
    expect(usedMeals(day)).toEqual(['petit-dejeuner', 'dejeuner'])
  })
})

describe('dates', () => {
  it('décale une date sans se tromper de mois', () => {
    expect(shiftDate('2026-08-01', -1)).toBe('2026-07-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('liste les journées enregistrées, la plus récente d’abord', () => {
    const days = {
      '2026-08-13': { date: '2026-08-13', entries: [line('a', 'dejeuner')] },
      '2026-08-15': { date: '2026-08-15', entries: [line('b', 'dejeuner')] },
      '2026-08-14': { date: '2026-08-14', entries: [] }
    }
    expect(loggedDays(days).map((d) => d.date)).toEqual(['2026-08-15', '2026-08-13'])
  })

  it('compte les journées enregistrées sur une fenêtre', () => {
    const days = {
      '2026-08-15': { date: '2026-08-15', entries: [line('a', 'dejeuner')] },
      '2026-07-01': { date: '2026-07-01', entries: [line('b', 'dejeuner')] }
    }
    expect(loggedCount(days, 30, new Date(2026, 7, 15))).toBe(1)
  })
})

describe('le passé ne bouge pas', () => {
  it('totalise depuis les instantanés, pas depuis le catalogue', () => {
    const day = addEntry(emptyDay('2026-08-15'), line('a', 'dejeuner', 250))
    expect(dayTotals(day).total.kcal).toBe(155)

    // Le produit est corrigé ailleurs : la journée reste identique.
    const catalogueChanged = { ...snapshot, kcal: 90 }
    expect(catalogueChanged.kcal).toBe(90)
    expect(dayTotals(day).total.kcal).toBe(155)
  })
})

/* Les mutations passent par l'état : on vérifie ici qu'enregistrer un aliment
   fige bien son instantané et alimente la mémoire. */
describe('mutations sur l’état', () => {
  let mod
  let storage

  beforeEach(async () => {
    storage = new MemoryStorage()
    vi.resetModules()
    mod = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await mod.initState(createDataStore(createLocalAdapter(storage)))
  })

  it('crée un aliment personnel et le rend résoluble', async () => {
    const res = await mod.createFood({ name: 'Skyr maison', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    expect(res.ok).toBe(true)
    expect(mod.resolveFood(res.food.id).name).toBe('Skyr maison')
  })

  it('refuse un aliment invalide avec le détail par champ', async () => {
    const res = await mod.createFood({ name: '', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    expect(res.ok).toBe(false)
    expect(res.errors.name).toBeTruthy()
    expect(Object.keys(mod.getState().nutrition.foods)).toHaveLength(0)
  })

  it('enregistre une ligne avec son instantané et nourrit la mémoire', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    const res = await mod.logFood({ foodId: food.id, qty: 250, meal: 'petit-dejeuner', date: '2026-08-15' })
    expect(res.ok).toBe(true)

    const state = mod.getState()
    const entry = state.nutrition.days['2026-08-15'].entries[0]
    expect(entry.snapshot.kcal).toBe(62)
    expect(entry.qty).toBe(250)
    expect(state.nutrition.usage[food.id].lastQty).toBe(250)
    expect(state.nutrition.usage[food.id].count).toBe(1)
  })

  it('garde la ligne intacte quand l’aliment change ensuite', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 100, date: '2026-08-15' })
    await mod.updateFood(food.id, { kcal: 90 })
    expect(mod.getState().nutrition.days['2026-08-15'].entries[0].snapshot.kcal).toBe(62)
  })

  it('garde la ligne lisible même si l’aliment est supprimé', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 200, date: '2026-08-15' })
    await mod.removeFood(food.id)
    const day = mod.getState().nutrition.days['2026-08-15']
    expect(dayTotals(day).total.kcal).toBe(124)
  })

  it('supprime la journée quand sa dernière ligne part', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    const { entry } = await mod.logFood({ foodId: food.id, qty: 100, date: '2026-08-15' })
    await mod.removeLogEntry('2026-08-15', entry.id)
    expect(mod.getState().nutrition.days['2026-08-15']).toBeUndefined()
  })

  it('bascule un favori et le retient', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 100, date: '2026-08-15' })
    expect(await mod.toggleFavorite(food.id)).toBe(true)
    expect(mod.getState().nutrition.usage[food.id].favorite).toBe(true)
  })

  it('refuse d’estimer les cibles sur un profil incomplet', async () => {
    const res = await mod.applyEstimatedTargets()
    expect(res.applied).toBe(false)
    expect(res.missing.length).toBeGreaterThan(0)
    expect(mod.getState().nutrition.targets.mode).toBeNull()
  })

  it('estime les cibles quand tout est connu, et garde la base du calcul', async () => {
    await mod.updateProfile({ sex: 'homme', birthYear: 1994, height: 178, goal: 'seche', activity: 'modere' })
    await mod.setBodyEntry('weight', { date: '2026-08-15', value: 80 })
    const res = await mod.applyEstimatedTargets()
    expect(res.applied).toBe(true)

    const targets = mod.getState().nutrition.targets
    expect(targets.mode).toBe('estimated')
    expect(targets.kcal).toBeGreaterThan(1500)
    expect(targets.basis.formula).toBe('mifflin-st-jeor')
  })

  it('fait primer une saisie manuelle sur l’estimation', async () => {
    await mod.updateProfile({ sex: 'homme', birthYear: 1994, height: 178, goal: 'seche', activity: 'modere' })
    await mod.setBodyEntry('weight', { date: '2026-08-15', value: 80 })
    await mod.applyEstimatedTargets()
    await mod.setManualTargets({ kcal: 2500, protein: 180 })

    const targets = mod.getState().nutrition.targets
    expect(targets.mode).toBe('manual')
    expect(targets.kcal).toBe(2500)
    expect(targets.basis).toBeNull()
  })

  it('survit à un rechargement complet', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 250, date: '2026-08-15' })

    vi.resetModules()
    const reloaded = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await reloaded.initState(createDataStore(createLocalAdapter(storage)))

    const state = reloaded.getState()
    expect(state.nutrition.days['2026-08-15'].entries[0].qty).toBe(250)
    expect(state.nutrition.usage[food.id].lastQty).toBe(250)
  })

  it('emporte la nutrition dans l’export', async () => {
    const { food } = await mod.createFood({ name: 'Skyr', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    await mod.logFood({ foodId: food.id, qty: 250, date: '2026-08-15' })
    const dump = JSON.parse(mod.exportJSON())
    expect(dump.nutrition.days['2026-08-15'].entries[0].snapshot.kcal).toBe(62)
    expect(dump.nutrition.foods[food.id]).toBeTruthy()
  })
})
