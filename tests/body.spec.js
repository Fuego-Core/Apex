/* Mesures corporelles : moyenne mobile, tendance, variation.
   Le point dur : ne jamais conclure trop vite. Ces tests vérifient autant ce
   que le module refuse de dire que ce qu'il calcule. */

import { describe, it, expect } from 'vitest'
import {
  today,
  sorted,
  upsert,
  removeAt,
  latest,
  movingAverage,
  currentAverage,
  trend,
  changeOver,
  latestChange,
  series
} from '../src/core/body.js'

/** Suite de mesures quotidiennes à partir d'une date. */
function daily(start, values) {
  const base = new Date(`${start}T12:00:00`)
  return values.map((value, i) => {
    const d = new Date(base.getTime() + i * 86400000)
    return { date: today(d), value }
  })
}

describe('today', () => {
  it('rend la date locale, pas la date UTC', () => {
    expect(today(new Date(2026, 7, 15, 23, 30))).toBe('2026-08-15')
    expect(today(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('sorted', () => {
  it('trie du plus ancien au plus récent', () => {
    const list = sorted([
      { date: '2026-08-10', value: 80 },
      { date: '2026-08-01', value: 81 }
    ])
    expect(list.map((e) => e.date)).toEqual(['2026-08-01', '2026-08-10'])
  })

  it('écarte les entrées inexploitables', () => {
    expect(sorted([{ date: '2026-08-01', value: 'beaucoup' }, null, { value: 80 }])).toEqual([])
  })
})

describe('upsert', () => {
  it('remplace la mesure du jour au lieu d’en empiler deux', () => {
    const list = upsert(upsert([], { date: '2026-08-15', value: 80 }), { date: '2026-08-15', value: 79.6 })
    expect(list).toHaveLength(1)
    expect(list[0].value).toBe(79.6)
  })

  it('supprime une mesure', () => {
    const list = upsert([], { date: '2026-08-15', value: 80 })
    expect(removeAt(list, '2026-08-15')).toEqual([])
  })
})

describe('moyenne mobile 7 jours', () => {
  it('moyenne bien sur la fenêtre', () => {
    const entries = daily('2026-08-01', [80, 82, 78])
    const ma = movingAverage(entries, 7)
    expect(ma[0].average).toBe(80)
    expect(ma[1].average).toBe(81)
    expect(ma[2].average).toBe(80)
  })

  it('raisonne en jours calendaires, pas en nombre de mesures', () => {
    const entries = [
      { date: '2026-08-01', value: 100 },
      { date: '2026-08-20', value: 80 }
    ]
    const ma = movingAverage(entries, 7)
    // La mesure du 1er est sortie de la fenêtre : elle ne tire plus la moyenne.
    expect(ma[1].average).toBe(80)
    expect(ma[1].samples).toBe(1)
  })

  it('rend la dernière moyenne, ou null sans mesure', () => {
    expect(currentAverage(daily('2026-08-01', [80, 80, 80]))).toBe(80)
    expect(currentAverage([])).toBeNull()
  })
})

describe('tendance', () => {
  it('refuse de conclure sur une seule pesée', () => {
    const t = trend([{ date: '2026-08-15', value: 80 }])
    expect(t.status).toBe('insufficient')
    expect(t.needEntries).toBe(4)
  })

  it('refuse de conclure sur trois jours', () => {
    expect(trend(daily('2026-08-13', [80, 79, 78])).status).toBe('insufficient')
  })

  it('voit une perte régulière', () => {
    const t = trend(daily('2026-07-20', [82, 81.8, 81.6, 81.4, 81.2, 81, 80.8, 80.6, 80.4, 80.2]))
    expect(t.status).toBe('ok')
    expect(t.direction).toBe('baisse')
    expect(t.perWeek).toBeLessThan(0)
  })

  it('voit une prise régulière', () => {
    const t = trend(daily('2026-07-20', [70, 70.2, 70.4, 70.6, 70.8, 71, 71.2, 71.4, 71.6, 71.8]))
    expect(t.direction).toBe('hausse')
    expect(t.perWeek).toBeGreaterThan(0)
  })

  it('dit « stable » quand le poids oscille sans partir nulle part', () => {
    const t = trend(daily('2026-07-20', [80, 80.4, 79.7, 80.2, 79.9, 80.1, 80, 79.8, 80.3, 80]))
    expect(t.direction).toBe('stable')
  })

  it('ne se laisse pas emporter par une seule journée salée', () => {
    const t = trend(daily('2026-07-20', [80, 80, 80, 80, 80, 80, 80, 80, 80, 82.5]))
    // La moyenne mobile absorbe le pic : pas de « prise de 2,5 kg ».
    expect(Math.abs(t.perWeek)).toBeLessThan(1)
  })
})

describe('variation', () => {
  it('compare deux moyennes mobiles distantes', () => {
    const change = changeOver(daily('2026-08-01', [81, 81, 81, 81, 81, 81, 81, 80, 80, 80, 80, 80, 80, 80]), 7)
    expect(change.delta).toBeLessThan(0)
    expect(change.days).toBe(7)
  })

  it('ne rend rien tant qu’il n’y a pas de recul', () => {
    expect(changeOver([{ date: '2026-08-15', value: 80 }], 7)).toBeNull()
    expect(changeOver(daily('2026-08-14', [80, 80]), 30)).toBeNull()
  })
})

describe('variation sur la plus longue fenêtre disponible', () => {
  it('retombe sur une fenêtre plus courte plutôt que de ne rien dire', () => {
    // 14 jours de données : pas de fenêtre à 30 jours, mais celle à 14 existe.
    const entries = daily('2026-08-01', Array.from({ length: 15 }, (_, i) => 81 - i * 0.15))
    const change = latestChange(entries)
    expect(change.window).toBe(14)
    expect(change.delta).toBeLessThan(0)
  })

  it('prend la fenêtre la plus longue quand elle existe', () => {
    const entries = daily('2026-07-01', Array.from({ length: 40 }, (_, i) => 81 - i * 0.05))
    expect(latestChange(entries).window).toBe(30)
  })

  it('ne rend rien quand rien n’est comparable', () => {
    expect(latestChange([{ date: '2026-08-15', value: 80 }])).toBeNull()
  })
})

describe('série pour graphique', () => {
  it('se limite à la fenêtre demandée', () => {
    const entries = [...daily('2026-05-01', [80, 80]), ...daily('2026-08-01', [79, 79])]
    expect(series(entries, { days: 30 })).toHaveLength(2)
  })

  it('rend une liste vide sans mesure', () => {
    expect(series([], { days: 30 })).toEqual([])
  })
})
