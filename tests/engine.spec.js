/* SPÉCIFICATION DU MOTEUR DE PROGRESSION.
   Ces tests décrivent le comportement d'APEX v1 tel qu'il existe aujourd'hui.
   Ils ne sont pas là pour documenter une intention : ils gèlent le comportement
   réel, pour qu'aucune évolution future ne le change par accident.
   Toute modification volontaire du moteur doit modifier ces tests EXPRÈS. */

import { describe, it, expect } from 'vitest'
import {
  evaluate,
  tonnage,
  workSets,
  isMixedWeight,
  round,
  PROGRESSION,
  TROP_LOURD,
  CONSTRUIRE,
  LOG
} from '../src/core/engine.js'

/** Exercice « reps » type : 3 séries de 8-10 à 50 kg, incrément 2,5. */
function ex(over = {}) {
  return {
    name: 'Test',
    mode: 'reps',
    sets: 3,
    repMin: 8,
    repMax: 10,
    weight: 50,
    increment: 2.5,
    rest: 90,
    note: '',
    assisted: false,
    ...over
  }
}

/** Série de travail validée. */
const set = (reps, weight, over = {}) => ({ reps, weight, done: true, warmup: false, ...over })

describe('workSets', () => {
  it('ne garde que les séries validées et non-échauffement', () => {
    const sets = [
      set(10, 50),
      set(10, 30, { warmup: true }),
      { reps: 10, weight: 50, done: false, warmup: false }
    ]
    expect(workSets(sets)).toHaveLength(1)
  })

  it('supporte une liste absente', () => {
    expect(workSets(undefined)).toEqual([])
    expect(workSets(null)).toEqual([])
  })
})

describe('round', () => {
  it('coupe les décimales flottantes parasites', () => {
    expect(round(47.499999999)).toBe(47.5)
    expect(round(0.1 + 0.2)).toBe(0.3)
    expect(round(52.5)).toBe(52.5)
  })
})

describe('isMixedWeight', () => {
  it('est faux quand toutes les séries de travail sont au même poids', () => {
    expect(isMixedWeight([set(10, 50), set(9, 50)])).toBe(false)
  })

  it('est vrai dès que deux séries de travail diffèrent', () => {
    expect(isMixedWeight([set(10, 50), set(9, 52.5)])).toBe(true)
  })

  it('ignore les échauffements', () => {
    expect(isMixedWeight([set(10, 50), set(12, 30, { warmup: true })])).toBe(false)
  })
})

describe('evaluate — mode temps', () => {
  it('ne juge pas : simple log, avec le total en secondes sous la minute', () => {
    const e = ex({ mode: 'temps', secMin: 45, secMax: 60 })
    const v = evaluate(e, [{ seconds: 45, done: true, warmup: false }])
    expect(v.status).toBe(LOG)
    expect(v.suggested).toBeNull()
    expect(v.weightUsed).toBe(0)
    expect(v.message).toContain('45 s')
  })

  it('affiche les minutes au-delà de 60 secondes', () => {
    const e = ex({ mode: 'temps' })
    const v = evaluate(e, [
      { seconds: 300, done: true, warmup: false },
      { seconds: 300, done: true, warmup: false }
    ])
    expect(v.message).toContain('10 min')
  })

  it('reste neutre quand rien n’a été validé', () => {
    const v = evaluate(ex({ mode: 'temps' }), [])
    expect(v.status).toBe(LOG)
    expect(v.message).toBe('Pas de moteur sur le mode temps.')
  })
})

describe('evaluate — aucune série de travail', () => {
  it('ne bouge pas le poids et ne rend aucun statut', () => {
    const v = evaluate(ex(), [set(10, 50, { warmup: true })])
    expect(v.status).toBeNull()
    expect(v.suggested).toBeNull()
    expect(v.weightUsed).toBe(50)
    expect(v.title).toBe('Non travaillé')
  })
})

describe('evaluate — progression', () => {
  it('monte du pas d’incrément quand toutes les séries sont au haut de la fourchette', () => {
    const v = evaluate(ex(), [set(10, 50), set(10, 50), set(10, 50)])
    expect(v.status).toBe(PROGRESSION)
    expect(v.suggested).toBe(52.5)
    expect(v.delta).toBe(2.5)
  })

  it('accepte de dépasser le haut de la fourchette', () => {
    const v = evaluate(ex(), [set(12, 50), set(11, 50), set(10, 50)])
    expect(v.status).toBe(PROGRESSION)
  })

  it('exige le nombre de séries prévues au programme', () => {
    const v = evaluate(ex({ sets: 3 }), [set(10, 50), set(10, 50)])
    expect(v.status).toBe(CONSTRUIRE)
  })

  it('exige un poids identique sur toutes les séries', () => {
    const v = evaluate(ex(), [set(10, 50), set(10, 52.5), set(10, 50)])
    expect(v.status).toBe(CONSTRUIRE)
    expect(v.mixed).toBe(true)
  })

  it('retire de l’assistance au lieu d’ajouter du poids', () => {
    const v = evaluate(ex({ assisted: true, weight: 25, increment: 2 }), [
      set(10, 25),
      set(10, 25),
      set(10, 25)
    ])
    expect(v.status).toBe(PROGRESSION)
    expect(v.suggested).toBe(23)
    expect(v.delta).toBe(-2)
    expect(v.message).toContain('assistance')
  })

  it('ne descend jamais sous zéro sur un exercice assisté', () => {
    const v = evaluate(ex({ assisted: true, weight: 1, increment: 2 }), [
      set(10, 1),
      set(10, 1),
      set(10, 1)
    ])
    expect(v.suggested).toBe(0)
  })
})

describe('evaluate — trop lourd', () => {
  it('redescend dès qu’une seule série passe sous le plancher', () => {
    const v = evaluate(ex(), [set(10, 50), set(9, 50), set(7, 50)])
    expect(v.status).toBe(TROP_LOURD)
    expect(v.suggested).toBe(47.5)
    expect(v.delta).toBe(-2.5)
  })

  it('remet de l’assistance sur un exercice assisté', () => {
    const v = evaluate(ex({ assisted: true, weight: 25, increment: 2, repMin: 8 }), [
      set(6, 25),
      set(8, 25),
      set(8, 25)
    ])
    expect(v.status).toBe(TROP_LOURD)
    expect(v.suggested).toBe(27)
  })

  it('ne descend jamais sous zéro', () => {
    const v = evaluate(ex({ weight: 1, increment: 2.5 }), [set(2, 1), set(2, 1), set(2, 1)])
    expect(v.suggested).toBe(0)
  })

  it('prend le poids le plus lourd comme référence si les séries diffèrent', () => {
    const v = evaluate(ex(), [set(4, 50), set(9, 45), set(9, 45)])
    expect(v.status).toBe(TROP_LOURD)
    expect(v.weightUsed).toBe(50)
    expect(v.mixed).toBe(true)
  })
})

describe('evaluate — construire', () => {
  it('garde le même poids entre plancher et plafond', () => {
    const v = evaluate(ex(), [set(9, 50), set(8, 50), set(8, 50)])
    expect(v.status).toBe(CONSTRUIRE)
    expect(v.suggested).toBe(50)
    expect(v.delta).toBe(0)
  })

  it('signale les poids mélangés dans son message', () => {
    const v = evaluate(ex(), [set(9, 50), set(9, 52.5), set(9, 50)])
    expect(v.status).toBe(CONSTRUIRE)
    expect(v.mixed).toBe(true)
    expect(v.message).toContain('Poids différents')
  })
})

describe('evaluate — les échauffements ne comptent jamais', () => {
  it('une série d’échauffement légère ne déclenche pas « trop lourd »', () => {
    const v = evaluate(ex(), [
      set(5, 30, { warmup: true }),
      set(10, 50),
      set(10, 50),
      set(10, 50)
    ])
    expect(v.status).toBe(PROGRESSION)
  })
})

describe('tonnage', () => {
  it('multiplie reps par poids sur les séries de travail', () => {
    expect(tonnage(ex(), [set(10, 50), set(8, 50)])).toBe(900)
  })

  it('exclut les échauffements', () => {
    expect(tonnage(ex(), [set(10, 50), set(10, 30, { warmup: true })])).toBe(500)
  })

  it('vaut zéro sur un exercice assisté (le poids soulage, il ne charge pas)', () => {
    expect(tonnage(ex({ assisted: true }), [set(10, 25)])).toBe(0)
  })

  it('vaut zéro en mode temps', () => {
    expect(tonnage(ex({ mode: 'temps' }), [{ seconds: 60, done: true, warmup: false }])).toBe(0)
  })
})
