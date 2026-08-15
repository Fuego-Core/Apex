/* MESURES CORPORELLES — poids, tour de taille.

   Règle de fond : on ne conclut JAMAIS à partir d'une seule pesée. Le poids
   d'un jour donné dit surtout ce qu'on a mangé et bu la veille. Ce qui compte,
   c'est la moyenne mobile et sa pente.

   Ce module est pur : il prend des entrées, il rend des nombres. Aucun DOM,
   aucun stockage. Une entrée = { date: 'AAAA-MM-JJ', value: nombre }. */

/** Date locale au format AAAA-MM-JJ (pas d'UTC : une pesée appartient au jour
 *  où l'utilisateur l'a faite, pas au fuseau du navigateur). */
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00`) / 86400000)

/** Entrées triées de la plus ancienne à la plus récente, valeurs invalides écartées. */
export function sorted(entries) {
  return (entries || [])
    .filter((e) => e && typeof e.date === 'string' && Number.isFinite(Number(e.value)))
    .map((e) => ({ date: e.date, value: Number(e.value), note: e.note ?? '' }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Ajoute ou remplace la mesure d'un jour : une seule valeur par date. */
export function upsert(entries, { date, value, note = '' }) {
  const rest = (entries || []).filter((e) => e.date !== date)
  return sorted([...rest, { date, value, note }])
}

export function removeAt(entries, date) {
  return sorted((entries || []).filter((e) => e.date !== date))
}

/** Dernière mesure connue. */
export function latest(entries) {
  const list = sorted(entries)
  return list.length ? list[list.length - 1] : null
}

/**
 * Moyenne mobile sur `days` jours calendaires (et non sur N mesures : peser
 * deux fois dans la semaine ou tous les jours ne doit pas changer la lecture).
 * @returns {{date, value, average, samples}[]} une entrée par mesure.
 */
export function movingAverage(entries, days = 7) {
  const list = sorted(entries)
  return list.map((e) => {
    const end = dayNumber(e.date)
    const start = end - (days - 1)
    const window = list.filter((x) => {
      const d = dayNumber(x.date)
      return d >= start && d <= end
    })
    const sum = window.reduce((a, x) => a + x.value, 0)
    return {
      date: e.date,
      value: e.value,
      average: Math.round((sum / window.length) * 100) / 100,
      samples: window.length
    }
  })
}

/** Moyenne mobile la plus récente, ou null si aucune mesure. */
export function currentAverage(entries, days = 7) {
  const ma = movingAverage(entries, days)
  return ma.length ? ma[ma.length - 1].average : null
}

/**
 * Tendance : pente de la moyenne mobile sur une fenêtre, en unité/semaine.
 * Refuse de répondre tant qu'il n'y a pas de quoi le faire honnêtement.
 * @returns {{status:'ok', perWeek, direction, from, to, days}
 *          |{status:'insufficient', entries, spanDays, needEntries, needSpanDays}}
 */
export function trend(entries, { windowDays = 28, minEntries = 4, minSpanDays = 7 } = {}) {
  const ma = movingAverage(entries, 7)
  const last = ma[ma.length - 1]
  const window = last
    ? ma.filter((e) => dayNumber(e.date) > dayNumber(last.date) - windowDays)
    : []

  const spanDays = window.length ? dayNumber(last.date) - dayNumber(window[0].date) : 0
  if (window.length < minEntries || spanDays < minSpanDays) {
    return {
      status: 'insufficient',
      entries: window.length,
      spanDays,
      needEntries: minEntries,
      needSpanDays: minSpanDays
    }
  }

  // Moindres carrés sur (jour, moyenne mobile).
  const x0 = dayNumber(window[0].date)
  const xs = window.map((e) => dayNumber(e.date) - x0)
  const ys = window.map((e) => e.average)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const perWeek = Math.round(slope * 7 * 100) / 100

  return {
    status: 'ok',
    perWeek,
    direction: Math.abs(perWeek) < 0.1 ? 'stable' : perWeek < 0 ? 'baisse' : 'hausse',
    from: window[0].average,
    to: last.average,
    days: spanDays
  }
}

/**
 * Variation de la moyenne mobile sur les `days` derniers jours.
 * @returns {{delta, from, to, days}|null}
 */
export function changeOver(entries, days = 7) {
  const ma = movingAverage(entries, 7)
  if (ma.length < 2) return null
  const last = ma[ma.length - 1]
  const targetDay = dayNumber(last.date) - days
  // La mesure la plus proche du début de fenêtre, sans jamais aller au-delà.
  const older = [...ma].reverse().find((e) => dayNumber(e.date) <= targetDay)
  if (!older) return null
  return {
    delta: Math.round((last.average - older.average) * 100) / 100,
    from: older.average,
    to: last.average,
    days: dayNumber(last.date) - dayNumber(older.date)
  }
}

/**
 * Variation sur la plus longue fenêtre dont on dispose réellement.
 * Afficher « 30 derniers jours : — » alors qu'on a deux semaines de données
 * est une non-réponse : mieux vaut dire ce qu'on sait, sur la période qu'on a.
 * @returns {{delta, from, to, days, window}|null}
 */
export function latestChange(entries, windows = [30, 14, 7]) {
  for (const window of windows) {
    const change = changeOver(entries, window)
    if (change) return { ...change, window }
  }
  return null
}

/** Points prêts pour un graphique, limités à une fenêtre. */
export function series(entries, { days = 90 } = {}) {
  const ma = movingAverage(entries, 7)
  if (!ma.length) return []
  const end = dayNumber(ma[ma.length - 1].date)
  return ma.filter((e) => dayNumber(e.date) > end - days)
}
