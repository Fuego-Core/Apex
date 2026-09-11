import { J0, nutritionTargets } from './config.js'
import { nutritionDay, state, TODAY } from './store.js'

function number(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function mean(values) {
  const valid = values.map(number).filter((value) => value !== null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function localTime(date) {
  const parsed = new Date(`${date}T12:00:00`).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function inLastDays(date, days = 7, now = new Date()) {
  const time = localTime(date)
  if (time === null) return false
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  const start = end - days * 864e5
  return time > start && time <= end
}

export function noPain(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return !normalized || ['aucune', 'aucun', 'non', 'rien', 'ras', 'r.a.s', 'aucune douleur', 'pas de douleur', '0'].includes(normalized)
}

export function currentBody() {
  return [...(state.body || [])]
    .filter((row) => row?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .reduce((body, row) => ({ ...body, ...row }), { ...J0 })
}

export function recentCheckins(limit = 3) {
  return [...(state.checkins || [])]
    .filter((item) => item?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
}

export function recoveryAssessment() {
  const recent = recentCheckins(3)
  if (!recent.length) {
    return {
      level: 'watch',
      label: 'À mesurer',
      title: 'Complète ton check-in',
      message: 'APEX a besoin de quelques données de récupération avant de conseiller l’intensité du jour.',
      sleep: null,
      feeling: null,
      fatigue: null,
      motivation: null,
      soreness: null,
      stress: null,
      pain: false,
      notes: []
    }
  }

  const sleep = mean(recent.map((item) => item.sleep))
  const feeling = mean(recent.map((item) => item.feeling))
  const fatigue = mean(recent.map((item) => item.fatigue))
  const motivation = mean(recent.map((item) => item.motivation))
  const soreness = mean(recent.map((item) => item.soreness))
  const stress = mean(recent.map((item) => item.stress))
  const last = recent[0]
  const pain = recent.some((item) => !noPain(item.pain))

  const severeRecoverySignal =
    pain ||
    (sleep !== null && sleep < 5.5) ||
    (feeling !== null && feeling < 5) ||
    (fatigue !== null && fatigue >= 8) ||
    (soreness !== null && soreness >= 8) ||
    (stress !== null && stress >= 8) ||
    (motivation !== null && motivation < 4)

  const moderateRecoverySignal =
    (sleep !== null && sleep < 6.5) ||
    (feeling !== null && feeling < 6.5) ||
    (fatigue !== null && fatigue >= 6) ||
    (soreness !== null && soreness >= 6) ||
    (stress !== null && stress >= 6) ||
    (motivation !== null && motivation < 6)

  let level = 'good'
  let label = 'Bonne récupération'
  let title = 'Séance normale'
  let message = 'Les derniers signaux sont compatibles avec la progression prévue. Respecte simplement le RIR cible.'

  if (severeRecoverySignal) {
    level = 'alert'
    label = 'Récupération basse'
    title = pain ? 'Douleur signalée' : 'Journée prudente'
    message = pain
      ? 'Une gêne a été signalée récemment. Ne force pas sur la zone concernée et garde davantage de marge.'
      : 'Plusieurs signaux de récupération sont bas. Réduis l’ambition du jour et garde 1 à 2 RIR de plus si nécessaire.'
  } else if (moderateRecoverySignal) {
    level = 'watch'
    label = 'À surveiller'
    title = 'Reste attentif'
    message = 'La séance prévue reste possible, mais n’impose pas une progression si les premières séries sont inhabituellement lourdes.'
  }

  const todayNutrition = nutritionDay(TODAY())
  const notes = []
  const protein = number(todayNutrition.protein)
  const kcal = number(todayNutrition.kcal)
  if (todayNutrition.source !== 'empty' && protein !== null && protein < nutritionTargets.protein * 0.75) {
    notes.push(`Protéines encore basses aujourd’hui (${Math.round(protein)} g).`)
  }
  if (todayNutrition.source !== 'empty' && kcal !== null && kcal > nutritionTargets.kcal * 1.15) {
    notes.push('Calories déjà nettement au-dessus de la cible quotidienne.')
  }
  if (!noPain(last?.pain)) notes.push(`Dernière gêne notée : ${String(last.pain).trim()}.`)
  if (fatigue !== null && fatigue >= 6) notes.push(`Fatigue moyenne ${fatigue.toFixed(1)}/10.`)
  if (soreness !== null && soreness >= 6) notes.push(`Courbatures moyennes ${soreness.toFixed(1)}/10.`)
  if (stress !== null && stress >= 6) notes.push(`Stress moyen ${stress.toFixed(1)}/10.`)

  return { level, label, title, message, sleep, feeling, fatigue, motivation, soreness, stress, pain, notes }
}

function bodyRows(days, now) {
  return (state.body || [])
    .filter((row) => row?.date && inLastDays(row.date, days, now))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function nutritionRows(days, now) {
  const dates = new Set([
    ...Object.keys(state.nutritionDays || {}),
    ...Object.keys(state.foodLog || {})
  ])
  return [...dates]
    .filter((date) => inLastDays(date, days, now))
    .sort()
    .map((date) => ({ date, ...nutritionDay(date) }))
    .filter((day) => day.source !== 'empty')
}

function historyRows(days, now) {
  return (state.history || []).filter((entry) => entry?.date && inLastDays(entry.date, days, now))
}

function checkinRows(days, now) {
  return (state.checkins || []).filter((entry) => entry?.date && inLastDays(entry.date, days, now))
}

function delta(rows, key) {
  const valid = rows.filter((row) => number(row[key]) !== null)
  if (valid.length < 2) return null
  return number(valid.at(-1)[key]) - number(valid[0][key])
}

function averageNutritionScore(rows) {
  if (!rows.length) return null
  const scores = rows.map((day) => {
    const kcal = number(day.kcal)
    const protein = number(day.protein)
    const kcalScore = kcal === null ? 0 : kcal >= nutritionTargets.kcal * 0.85 && kcal <= nutritionTargets.kcal * 1.15 ? 100 : 55
    const proteinScore = protein === null ? 0 : Math.min(100, protein / nutritionTargets.protein * 100)
    return kcalScore * 0.45 + proteinScore * 0.55
  })
  return mean(scores)
}

export function weeklySummary({ days = 7, now = new Date() } = {}) {
  const body = bodyRows(days, now)
  const nutrition = nutritionRows(days, now)
  const history = historyRows(days, now)
  const checkins = checkinRows(days, now)
  const pains = checkins.filter((item) => !noPain(item.pain)).map((item) => String(item.pain).trim())
  const completedSets = history.reduce((total, entry) => {
    return total + Object.values(entry.exercises || {}).reduce((exerciseTotal, exercise) => {
      return exerciseTotal + (exercise.sets || []).filter((set) => set?.done).length
    }, 0)
  }, 0)

  const trainingScore = Math.min(100, history.length / 4 * 100)
  const nutritionScore = averageNutritionScore(nutrition)
  const sleepScore = checkins.length
    ? mean(checkins.map((item) => {
      const sleep = number(item.sleep)
      return sleep === null ? null : Math.min(100, sleep / 7 * 100)
    }))
    : null
  const availableScores = [trainingScore, nutritionScore, sleepScore].filter((score) => score !== null)
  const adherence = availableScores.length ? Math.round(mean(availableScores)) : null

  return {
    days,
    sessions: history.length,
    completedSets,
    weightAvg: mean(body.map((item) => item.weight)),
    weightDelta: delta(body, 'weight'),
    latestWeight: number(body.at(-1)?.weight) ?? number(currentBody().weight),
    latestNavel: number(body.at(-1)?.navel) ?? number(currentBody().navel),
    navelDelta: delta(body, 'navel'),
    kcalAvg: mean(nutrition.map((item) => item.kcal)),
    proteinAvg: mean(nutrition.map((item) => item.protein)),
    nutritionDays: nutrition.length,
    sleepAvg: mean(checkins.map((item) => item.sleep)),
    feelingAvg: mean(checkins.map((item) => item.feeling)),
    fatigueAvg: mean(checkins.map((item) => item.fatigue)),
    motivationAvg: mean(checkins.map((item) => item.motivation)),
    sorenessAvg: mean(checkins.map((item) => item.soreness)),
    stressAvg: mean(checkins.map((item) => item.stress)),
    checkinDays: checkins.length,
    pains,
    adherence,
    adherenceCoverage: {
      training: true,
      nutrition: nutrition.length > 0,
      recovery: checkins.length > 0
    }
  }
}

function format(value, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

export function buildCoachReport({ days = 7 } = {}) {
  const summary = weeklySummary({ days })
  const recovery = recoveryAssessment()
  return [
    `APEX — Rapport coach ${days} jours`,
    `Semaine programme : ${state.currentWeek}/6`,
    `Séances : ${summary.sessions}/4 · Séries validées : ${summary.completedSets}`,
    `Poids moyen : ${format(summary.weightAvg)} kg · Poids actuel : ${format(summary.latestWeight)} kg`,
    `Variation poids : ${summary.weightDelta === null ? '—' : `${summary.weightDelta >= 0 ? '+' : ''}${format(summary.weightDelta)} kg`}`,
    `Nombril actuel : ${format(summary.latestNavel)} cm · Variation : ${summary.navelDelta === null ? '—' : `${summary.navelDelta >= 0 ? '+' : ''}${format(summary.navelDelta)} cm`}`,
    `Nutrition : ${summary.nutritionDays}/${days} jours suivis · ${format(summary.kcalAvg, 0)} kcal/j · ${format(summary.proteinAvg, 0)} g protéines/j`,
    `Récupération : ${summary.checkinDays}/${days} check-ins · ${format(summary.sleepAvg)} h sommeil · forme ${format(summary.feelingAvg)}/10`,
    `Fatigue : ${format(summary.fatigueAvg)}/10 · Motivation : ${format(summary.motivationAvg)}/10 · Courbatures : ${format(summary.sorenessAvg)}/10 · Stress : ${format(summary.stressAvg)}/10`,
    `Douleurs/gênes : ${summary.pains.length ? summary.pains.join(' | ') : 'Aucune signalée'}`,
    `Adhérence indicative : ${summary.adherence === null ? '—' : `${summary.adherence}/100`} (à interpréter avec la couverture des données)`,
    `Décision APEX actuelle : ${recovery.title} — ${recovery.message}`,
    'Objectif : recomposition — nombril ↓, performances ↑, récupération stable, sans décision basée sur une seule journée.'
  ].join('\n')
}
