/* OBJECTIFS — un objectif lit une valeur RÉELLE quelque part.

   Aucun objectif n'invente sa valeur courante : soit elle vient des mesures
   (poids, tour de taille), soit de l'historique des séances (force, régularité),
   soit l'utilisateur la saisit lui-même. Un objectif dont la source ne dit rien
   affiche « pas encore de données », pas un zéro déguisé en progrès.

   kind:
     'weight'   -> moyenne 7 jours du poids
     'waist'    -> dernier tour de taille
     'strength' -> meilleur poids de travail d'un mouvement (historique)
     'sessions' -> séances par semaine sur les 28 derniers jours
     'manual'   -> valeur saisie à la main (habitudes, pas, etc.) */

import { currentAverage, latest } from './body.js'

export const GOAL_KINDS = ['weight', 'waist', 'strength', 'sessions', 'manual']

const round = (n) => Math.round(n * 100) / 100

/** Nombre exploitable, ou null. Piège à éviter : Number(null) vaut 0, ce qui
 *  transformerait « pas encore de donnée » en « zéro », donc en faux progrès. */
const asNumber = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Meilleur poids de travail enregistré pour un mouvement. */
function bestWeight(history, exerciseId) {
  let best = null
  for (const session of history || []) {
    for (const entry of session.entries || []) {
      if (entry.exerciseId !== exerciseId || entry.mode !== 'reps' || entry.assisted) continue
      for (const set of entry.sets || []) {
        if (set.warmup || !set.done) continue
        const w = Number(set.weight) || 0
        if (best === null || w > best) best = w
      }
    }
  }
  return best
}

/** Séances par semaine sur une fenêtre glissante. */
function sessionsPerWeek(history, days = 28, now = new Date()) {
  if (!history?.length) return null
  const since = now.getTime() - days * 86400000
  const count = history.filter((h) => Date.parse(h.startedAt) >= since).length
  return round((count / days) * 7)
}

/** Valeur courante d'un objectif, ou null si la source ne dit encore rien. */
export function currentValue(goal, { body, history, now = new Date() } = {}) {
  switch (goal.kind) {
    case 'weight':
      return currentAverage(body?.weight)
    case 'waist':
      return latest(body?.waist)?.value ?? null
    case 'strength':
      return goal.exerciseId ? bestWeight(history, goal.exerciseId) : null
    case 'sessions':
      return sessionsPerWeek(history, 28, now)
    case 'manual':
      return asNumber(goal.value)
    default:
      return null
  }
}

/**
 * Avancement d'un objectif.
 * @returns {{current, target, start, pct, remaining, done, direction, hasData}}
 */
export function evaluateGoal(goal, context = {}) {
  const current = currentValue(goal, context)
  const target = asNumber(goal.target)
  // Pas de repli sur la valeur courante : un objectif sans point de départ
  // connu n'a pas de pourcentage, et c'est une réponse honnête.
  const start = asNumber(goal.start)
  const reference = start ?? current
  const direction =
    goal.direction || (reference !== null && target !== null && target < reference ? 'down' : 'up')

  if (current === null || target === null) {
    return { current, target, start, pct: null, remaining: null, done: false, direction, hasData: false }
  }

  const span = start === null ? null : target - start
  const pct =
    span === null || span === 0
      ? null
      : Math.max(0, Math.min(100, Math.round(((current - start) / span) * 100)))

  const done = direction === 'down' ? current <= target : current >= target

  return {
    current: round(current),
    target: round(target),
    start: start === null ? null : round(start),
    pct: done ? 100 : pct,
    remaining: round(Math.abs(target - current)),
    done,
    direction,
    hasData: true
  }
}

/** Objectif neuf, prêt à être stocké. */
export function makeGoal({ id, kind, title, unit, target, start = null, direction = null, deadline = null, exerciseId = null, value = null }, now = new Date()) {
  const startValue = asNumber(start)
  return {
    id,
    kind,
    title,
    unit: unit || '',
    target: asNumber(target),
    start: startValue,
    direction: direction || (startValue !== null && asNumber(target) < startValue ? 'down' : 'up'),
    deadline,
    exerciseId,
    value: asNumber(value),
    createdAt: now.toISOString(),
    history: []
  }
}

/** Trace une valeur saisie à la main, en gardant l'historique du chemin. */
export function recordManualValue(goal, value, now = new Date()) {
  const v = Number(value)
  if (!Number.isFinite(v)) return goal
  return {
    ...goal,
    value: v,
    start: goal.start === null ? v : goal.start,
    history: [...(goal.history || []), { at: now.toISOString(), value: v }].slice(-100)
  }
}
