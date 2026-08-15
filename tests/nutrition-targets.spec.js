/* Cibles nutritionnelles. Le point vérifié en priorité : APEX ne produit
   JAMAIS une estimation partielle en comblant les trous avec des valeurs
   moyennes. Sans toutes les entrées, il dit ce qui manque. */

import { describe, it, expect } from 'vitest'
import {
  estimateTargets,
  basalMetabolicRate,
  effectiveTargets,
  explain
} from '../src/core/nutrition/targets.js'

const profile = {
  sex: 'homme',
  birthYear: 1994,
  height: 178,
  goal: 'seche',
  experience: 'intermediaire',
  activity: 'modere',
  trainingDays: 4,
  sessionDuration: 60
}
const now = new Date('2026-08-15T09:00:00.000Z')

describe('métabolisme de base', () => {
  it('applique Mifflin-St Jeor pour un homme', () => {
    // 10×80 + 6,25×178 − 5×32 + 5 = 1757,5
    expect(basalMetabolicRate({ sex: 'homme', weightKg: 80, heightCm: 178, age: 32 })).toBeCloseTo(1757.5, 1)
  })

  it('applique la variante femme', () => {
    expect(basalMetabolicRate({ sex: 'femme', weightKg: 65, heightCm: 165, age: 30 })).toBeCloseTo(1370.25, 1)
  })

  it('ne calcule rien pour un sexe non renseigné', () => {
    expect(basalMetabolicRate({ sex: null, weightKg: 80, heightCm: 178, age: 32 })).toBeNull()
  })
})

describe('estimation', () => {
  it('produit des cibles cohérentes', () => {
    const t = estimateTargets({ profile, weightKg: 80, now })
    expect(t.status).toBe('ok')
    expect(t.kcal).toBeGreaterThan(1800)
    expect(t.kcal).toBeLessThan(2600)
    expect(t.protein).toBe(160) // 80 kg × 2 g/kg en sèche
    expect(t.fat).toBeGreaterThan(0)
    expect(t.carbs).toBeGreaterThan(0)
  })

  it('rend les macros compatibles avec les calories visées', () => {
    const t = estimateTargets({ profile, weightKg: 80, now })
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9
    expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(30)
  })

  it('expose tout ce qui a servi au calcul', () => {
    const { basis } = estimateTargets({ profile, weightKg: 80, now })
    expect(basis.formula).toBe('mifflin-st-jeor')
    expect(basis.age).toBe(32)
    expect(basis.weightKg).toBe(80)
    expect(basis.activityFactor).toBe(1.55)
    expect(basis.adjustmentKcal).toBe(-400)
    expect(basis.proteinPerKg).toBe(2)
  })

  it('sait s’expliquer en une phrase lisible', () => {
    const { basis } = estimateTargets({ profile, weightKg: 80, now })
    const phrase = explain(basis)
    expect(phrase).toContain('Mifflin-St Jeor')
    expect(phrase).toContain('Perdre du gras')
    expect(phrase).toContain('2 g/kg')
  })

  it('mange moins en sèche qu’en prise de masse', () => {
    const cut = estimateTargets({ profile, weightKg: 80, now })
    const bulk = estimateTargets({ profile: { ...profile, goal: 'prise' }, weightKg: 80, now })
    expect(cut.kcal).toBeLessThan(bulk.kcal)
  })

  it('suit le niveau d’activité', () => {
    const calme = estimateTargets({ profile: { ...profile, activity: 'sedentaire' }, weightKg: 80, now })
    const actif = estimateTargets({ profile: { ...profile, activity: 'intense' }, weightKg: 80, now })
    expect(actif.kcal).toBeGreaterThan(calme.kcal)
  })

  it('ne descend jamais sous un plancher', () => {
    const t = estimateTargets({ profile: { ...profile, activity: 'sedentaire' }, weightKg: 40, now })
    expect(t.kcal).toBeGreaterThanOrEqual(1200)
  })
})

describe('estimation impossible', () => {
  it('liste précisément ce qui manque', () => {
    const t = estimateTargets({ profile: { ...profile, height: null, activity: null }, weightKg: 80, now })
    expect(t.status).toBe('incomplete')
    expect(t.missing).toContain('taille')
    expect(t.missing).toContain('activité')
    expect(t.kcal).toBeUndefined()
  })

  it('refuse d’estimer sans poids', () => {
    const t = estimateTargets({ profile, weightKg: null, now })
    expect(t.status).toBe('incomplete')
    expect(t.missing).toEqual(['poids'])
  })

  it('refuse d’estimer sur un profil vide plutôt que d’inventer', () => {
    const t = estimateTargets({ profile: {}, weightKg: null, now })
    expect(t.status).toBe('incomplete')
    expect(t.missing.length).toBe(6)
  })

  it('n’estime pas pour un sexe hors formule', () => {
    const t = estimateTargets({ profile: { ...profile, sex: 'autre' }, weightKg: 80, now })
    expect(t.status).toBe('incomplete')
    expect(t.missing).toContain('sexe')
  })
})

describe('cibles effectives', () => {
  it('rend null tant que rien n’est configuré', () => {
    expect(effectiveTargets({ mode: null, kcal: null })).toBeNull()
    expect(effectiveTargets(null)).toBeNull()
  })

  it('rend les valeurs manuelles telles quelles', () => {
    const t = effectiveTargets({ mode: 'manual', kcal: 2400, protein: 160, carbs: null, fat: 70, fiber: null })
    expect(t.kcal).toBe(2400)
    expect(t.carbs).toBeNull()
    expect(t.mode).toBe('manual')
  })

  it('garde la trace du mode estimé', () => {
    expect(effectiveTargets({ mode: 'estimated', kcal: 2300 }).mode).toBe('estimated')
  })
})
