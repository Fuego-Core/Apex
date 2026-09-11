import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  }
}

async function loadCoach(seed = {}) {
  vi.stubGlobal('localStorage', memoryStorage({ 'apex-coach-pro-v1': JSON.stringify(seed) }))
  const store = await import('../src/app/store.js')
  const coach = await import('../src/app/coach-engine.js')
  return { ...coach, state: store.state }
}

describe('moteur Coach APEX', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('autorise une séance normale quand sommeil et sensations sont bons', async () => {
    const { recoveryAssessment } = await loadCoach({
      checkins: [
        { date: '2026-09-09', sleep: '7.2', feeling: '8', pain: 'Aucune' },
        { date: '2026-09-10', sleep: '7.0', feeling: '7', pain: 'RAS' },
        { date: '2026-09-11', sleep: '7.5', feeling: '8', pain: '' }
      ]
    })

    expect(recoveryAssessment()).toMatchObject({ level: 'good', title: 'Séance normale', pain: false })
  })

  it('passe en prudence lorsqu’une douleur est signalée', async () => {
    const { recoveryAssessment } = await loadCoach({
      checkins: [
        { date: '2026-09-11', sleep: '7', feeling: '8', pain: 'épaule droite' }
      ]
    })

    const result = recoveryAssessment()
    expect(result.level).toBe('alert')
    expect(result.title).toBe('Douleur signalée')
    expect(result.notes.join(' ')).toContain('épaule droite')
  })

  it('agrège réellement les 7 derniers jours sans inventer les jours manquants', async () => {
    const { weeklySummary } = await loadCoach({
      body: [
        { date: '2026-09-08', weight: 75.2, navel: 96 },
        { date: '2026-09-11', weight: 74.8, navel: 95.4 }
      ],
      history: [
        { id: 'a', date: '2026-09-08', exercises: { 0: { sets: [{ done: true }, { done: true }] } } },
        { id: 'b', date: '2026-09-10', exercises: { 0: { sets: [{ done: true }] } } }
      ],
      checkins: [
        { date: '2026-09-10', sleep: '7', feeling: '7', pain: '' },
        { date: '2026-09-11', sleep: '6.5', feeling: '7', pain: '' }
      ],
      nutritionDays: {
        '2026-09-10': { kcal: '2250', protein: '150' },
        '2026-09-11': { kcal: '2320', protein: '160' }
      }
    })

    const summary = weeklySummary({ now: new Date(2026, 8, 11, 12, 0, 0) })
    expect(summary.sessions).toBe(2)
    expect(summary.completedSets).toBe(3)
    expect(summary.nutritionDays).toBe(2)
    expect(summary.checkinDays).toBe(2)
    expect(summary.latestNavel).toBe(95.4)
    expect(summary.navelDelta).toBeCloseTo(-0.6)
    expect(summary.kcalAvg).toBe(2285)
    expect(summary.proteinAvg).toBe(155)
  })

  it('produit un rapport lisible destiné au coach externe', async () => {
    const { buildCoachReport } = await loadCoach({
      currentWeek: 2,
      body: [{ date: '2026-09-11', weight: 75, navel: 96 }],
      checkins: [{ date: '2026-09-11', sleep: '7', feeling: '8', pain: 'Aucune' }],
      nutritionDays: { '2026-09-11': { kcal: '2300', protein: '155' } }
    })

    const report = buildCoachReport()
    expect(report).toContain('APEX — Rapport coach 7 jours')
    expect(report).toContain('Semaine programme : 2/6')
    expect(report).toContain('Nutrition :')
    expect(report).toContain('Récupération :')
    expect(report).toContain('Objectif : recomposition')
  })
})
