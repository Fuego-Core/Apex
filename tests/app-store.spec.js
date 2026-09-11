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

async function loadStore(seed = null) {
  const storage = memoryStorage(seed ? { 'apex-coach-pro-v1': JSON.stringify(seed) } : {})
  vi.stubGlobal('localStorage', storage)
  const module = await import('../src/app/store.js')
  return { ...module, storage }
}

describe('store actif APEX', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalise les anciennes données de la nouvelle app sans perdre leur contenu', async () => {
    const { state } = await loadStore({
      createdAt: '2026-09-01',
      currentWeek: 3,
      body: [{ date: '2026-09-10', weight: 74.2, navel: 94 }],
      sessions: { '3:upper-a': { completed: true } },
      history: [{ id: 'h1' }],
      checkins: [],
      nutritionDays: { '2026-09-10': { kcal: '2200' } }
    })

    expect(state.schemaVersion).toBe(2)
    expect(state.currentWeek).toBe(3)
    expect(state.body.at(-1).weight).toBe(74.2)
    expect(state.sessions['3:upper-a'].completed).toBe(true)
    expect(state.history).toHaveLength(1)
    expect(state.pantry).toEqual([])
    expect(state.foodLog).toEqual({})
    expect(state.foodFavorites).toEqual([])
    expect(state.body.find((row) => row.date === '2026-09-11')).toMatchObject({
      weight: 75,
      neck: 42,
      chest: 101,
      waist: 88,
      navel: 96,
      hips: 102.5
    })
  })

  it('borne une semaine invalide entre 1 et 6', async () => {
    const { state } = await loadStore({ currentWeek: 99 })
    expect(state.currentWeek).toBe(6)
  })

  it('forme la date à partir du jour local et non de la date UTC sérialisée', async () => {
    const { TODAY } = await loadStore()
    expect(TODAY(new Date(2026, 0, 2, 0, 15))).toBe('2026-01-02')
  })

  it('calcule les macros du journal scanné', async () => {
    const { nutritionLogTotals } = await loadStore({
      foodLog: {
        '2026-09-11': [
          { kcal: 250, protein: 20, carbs: 30, fat: 6 },
          { kcal: 125.5, protein: 10.2, carbs: 12, fat: 3.5 }
        ]
      }
    })

    expect(nutritionLogTotals('2026-09-11')).toEqual({
      kcal: 375.5,
      protein: 30.2,
      carbs: 42,
      fat: 9.5,
      count: 2
    })
  })

  it('fait primer un scan récent sur un ancien bilan manuel devenu obsolète', async () => {
    const { nutritionDay } = await loadStore({
      nutritionDays: {
        '2026-09-11': {
          kcal: '500', protein: '25', carbs: '60', fat: '12',
          updatedAt: '2026-09-11T12:00:00.000Z'
        }
      },
      foodLog: {
        '2026-09-11': [
          { kcal: 620.44, protein: 41.26, carbs: 70.04, fat: 18.28, at: '2026-09-11T13:00:00.000Z' }
        ]
      }
    })

    const day = nutritionDay('2026-09-11')
    expect(day.kcal).toBe(620.4)
    expect(day.protein).toBe(41.3)
    expect(day.carbs).toBe(70)
    expect(day.fat).toBe(18.3)
    expect(day.scanned.count).toBe(1)
    expect(day.source).toBe('scanner')
  })

  it('respecte une correction manuelle enregistrée après le dernier scan', async () => {
    const { nutritionDay } = await loadStore({
      nutritionDays: {
        '2026-09-11': {
          kcal: '600', protein: '40', carbs: '65', fat: '17',
          updatedAt: '2026-09-11T14:00:00.000Z'
        }
      },
      foodLog: {
        '2026-09-11': [
          { kcal: 620.44, protein: 41.26, carbs: 70.04, fat: 18.28, at: '2026-09-11T13:00:00.000Z' }
        ]
      }
    })

    expect(nutritionDay('2026-09-11')).toMatchObject({
      kcal: '600', protein: '40', carbs: '65', fat: '17', source: 'manual'
    })
  })

  it('conserve le bilan manuel lorsqu’aucun aliment n’a été journalisé', async () => {
    const { nutritionDay } = await loadStore({
      nutritionDays: {
        '2026-09-11': { kcal: '2250', protein: '152', carbs: '240', fat: '68' }
      }
    })

    expect(nutritionDay('2026-09-11')).toMatchObject({
      kcal: '2250', protein: '152', carbs: '240', fat: '68', source: 'manual'
    })
  })

  it('persiste le même objet partagé utilisé par le scanner et les vues', async () => {
    const { save, state, storage } = await loadStore()
    state.pantry.push({ barcode: '3017620422003', name: 'Produit test', qty: 1, unit: 'unité' })
    state.foodLog['2026-09-11'] = [{ kcal: 100, protein: 5, carbs: 10, fat: 2 }]

    save()
    const persisted = JSON.parse(storage.getItem('apex-coach-pro-v1'))
    expect(persisted.schemaVersion).toBe(2)
    expect(persisted.pantry[0].barcode).toBe('3017620422003')
    expect(persisted.foodLog['2026-09-11']).toHaveLength(1)
  })

  it('exporte une sauvegarde versionnée puis restaure les données en place', async () => {
    const { exportState, restoreState, state, storage } = await loadStore({
      currentWeek: 2,
      body: [{ date: '2026-09-11', weight: 75, navel: 96 }],
      pantry: [{ barcode: '12345678', name: 'Test', qty: 1, unit: 'unité' }]
    })

    const backup = exportState()
    expect(backup).toMatchObject({ format: 'apex-backup', version: 2 })
    expect(backup.data.currentWeek).toBe(2)

    state.currentWeek = 6
    state.pantry = []
    restoreState(backup)

    expect(state.currentWeek).toBe(2)
    expect(state.pantry).toHaveLength(1)
    expect(JSON.parse(storage.getItem('apex-coach-pro-v1')).currentWeek).toBe(2)
  })

  it('normalise aussi les sauvegardes importées avant de remplacer l’état', async () => {
    const { restoreState, state } = await loadStore()
    restoreState({ format: 'apex-backup', data: { currentWeek: 99, pantry: 'invalide' } })
    expect(state.currentWeek).toBe(6)
    expect(state.pantry).toEqual([])
    expect(Array.isArray(state.body)).toBe(true)
    expect(state.schemaVersion).toBe(2)
  })
})
