/* Objectifs et « quoi faire aujourd'hui ».
   Règle vérifiée ici : aucune valeur n'est inventée. Sans données, un objectif
   le dit (hasData: false) au lieu d'afficher 0 %. */

import { describe, it, expect } from 'vitest'
import { evaluateGoal, currentValue, makeGoal, recordManualValue } from '../src/core/goals.js'
import { nextSession, sessionsThisWeek, averageDuration, estimateDuration, pendingCount } from '../src/core/today.js'

const body = {
  weight: [
    { date: '2026-08-10', value: 80 },
    { date: '2026-08-12', value: 79.5 },
    { date: '2026-08-14', value: 79.4 }
  ],
  waist: [
    { date: '2026-08-01', value: 88 },
    { date: '2026-08-14', value: 86.5 }
  ]
}

const history = [
  {
    id: 'h1',
    startedAt: '2026-08-14T18:00:00.000Z',
    durationSec: 3600,
    entries: [
      {
        exerciseId: 'supine-press-machine',
        mode: 'reps',
        assisted: false,
        sets: [
          { done: true, warmup: false, weight: 60, reps: 8 },
          { done: true, warmup: true, weight: 90, reps: 3 }
        ]
      }
    ]
  },
  {
    id: 'h2',
    startedAt: '2026-08-12T18:00:00.000Z',
    durationSec: 3000,
    entries: [
      {
        exerciseId: 'supine-press-machine',
        mode: 'reps',
        assisted: false,
        sets: [{ done: true, warmup: false, weight: 57.5, reps: 8 }]
      }
    ]
  }
]

const now = new Date('2026-08-15T09:00:00.000Z')

describe('valeur courante', () => {
  it('lit le poids dans la moyenne 7 jours, pas dans la dernière pesée', () => {
    const v = currentValue({ kind: 'weight' }, { body })
    expect(v).toBeCloseTo(79.63, 1)
  })

  it('lit le dernier tour de taille', () => {
    expect(currentValue({ kind: 'waist' }, { body })).toBe(86.5)
  })

  it('lit le meilleur poids de travail, échauffements exclus', () => {
    expect(currentValue({ kind: 'strength', exerciseId: 'supine-press-machine' }, { history })).toBe(60)
  })

  it('rend null quand la source ne dit rien', () => {
    expect(currentValue({ kind: 'weight' }, { body: { weight: [], waist: [] } })).toBeNull()
    expect(currentValue({ kind: 'strength', exerciseId: 'inconnu' }, { history })).toBeNull()
    expect(currentValue({ kind: 'manual', value: null })).toBeNull()
  })

  it('compte les séances par semaine sur la fenêtre', () => {
    expect(currentValue({ kind: 'sessions' }, { history, now })).toBe(0.5)
  })
})

describe('avancement', () => {
  it('calcule un pourcentage sur le chemin réellement parcouru', () => {
    const goal = makeGoal({ id: 'g1', kind: 'weight', title: 'Poids', unit: 'kg', target: 75, start: 85 })
    const r = evaluateGoal(goal, { body })
    expect(r.direction).toBe('down')
    expect(r.pct).toBe(54) // 85 -> 79,63 sur 85 -> 75
    expect(r.done).toBe(false)
    expect(r.remaining).toBeCloseTo(4.63, 1)
  })

  it('marque un objectif atteint quand la cible est franchie', () => {
    const goal = makeGoal({ id: 'g2', kind: 'waist', title: 'Taille', unit: 'cm', target: 87, start: 90 })
    const r = evaluateGoal(goal, { body })
    expect(r.done).toBe(true)
    expect(r.pct).toBe(100)
  })

  it('gère un objectif à la hausse', () => {
    const goal = makeGoal({
      id: 'g3',
      kind: 'strength',
      title: 'Développé',
      unit: 'kg',
      target: 80,
      start: 50,
      exerciseId: 'supine-press-machine'
    })
    const r = evaluateGoal(goal, { history })
    expect(r.direction).toBe('up')
    expect(r.current).toBe(60)
    expect(r.pct).toBe(33)
  })

  it('dit qu’il n’a pas de données au lieu d’afficher zéro', () => {
    const goal = makeGoal({ id: 'g4', kind: 'weight', title: 'Poids', unit: 'kg', target: 75, start: 85 })
    const r = evaluateGoal(goal, { body: { weight: [], waist: [] } })
    expect(r.hasData).toBe(false)
    expect(r.pct).toBeNull()
    expect(r.done).toBe(false)
  })

  it('n’invente pas de pourcentage sans point de départ', () => {
    const goal = makeGoal({ id: 'g5', kind: 'manual', title: 'Pas', unit: 'pas', target: 10000 })
    const r = evaluateGoal({ ...goal, value: 6000, start: null }, {})
    expect(r.current).toBe(6000)
    expect(r.pct).toBeNull()
  })

  it('garde la trace des valeurs saisies à la main', () => {
    let goal = makeGoal({ id: 'g6', kind: 'manual', title: 'Pas', unit: 'pas', target: 10000 })
    goal = recordManualValue(goal, 8000, now)
    goal = recordManualValue(goal, 9000, now)
    expect(goal.value).toBe(9000)
    expect(goal.start).toBe(8000)
    expect(goal.history).toHaveLength(2)
  })
})

describe('séance du jour', () => {
  const program = [
    { id: 'push', name: 'Push', lastDoneAt: '2026-08-10T18:00:00.000Z' },
    { id: 'pull', name: 'Pull', lastDoneAt: '2026-08-13T18:00:00.000Z' },
    { id: 'legs', name: 'Legs', lastDoneAt: null }
  ]

  it('propose d’abord de reprendre une séance en cours', () => {
    const r = nextSession(program, { live: { sessionId: 'pull' }, now })
    expect(r.session.id).toBe('pull')
    expect(r.reason).toBe('reprise')
  })

  it('propose une séance jamais faite avant les autres', () => {
    expect(nextSession(program, { now }).session.id).toBe('legs')
  })

  it('propose sinon la plus ancienne', () => {
    const done = program.map((s) => ({ ...s, lastDoneAt: s.lastDoneAt || '2026-08-14T18:00:00.000Z' }))
    const r = nextSession(done, { now })
    expect(r.session.id).toBe('push')
    expect(r.reason).toBe('la-plus-ancienne')
    expect(r.daysSince).toBe(4)
  })

  it('ne propose rien sans programme', () => {
    expect(nextSession([], {})).toBeNull()
  })

  it('compte les séances de la semaine et la durée moyenne', () => {
    expect(sessionsThisWeek(history, now)).toBe(2)
    expect(averageDuration(history)).toBe(3300)
    expect(averageDuration([])).toBeNull()
  })

  it('estime une durée à partir du programme', () => {
    const session = {
      exercises: [
        { mode: 'reps', sets: 4, rest: 120 },
        { mode: 'temps', sets: 1, secMax: 900, rest: 0 }
      ]
    }
    expect(estimateDuration(session)).toBe(4 * 165 + 900)
    expect(estimateDuration({ exercises: [] })).toBeNull()
  })

  it('compte les suggestions en attente, hors « on garde le poids »', () => {
    const session = {
      exercises: [
        { pending: { delta: 2.5 } },
        { pending: { delta: 0 } },
        { pending: null }
      ]
    }
    expect(pendingCount(session)).toBe(1)
  })
})
