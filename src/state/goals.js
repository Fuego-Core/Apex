/* Objectifs — mutations. */

import { getState, save } from './index.js'

export function addGoal(goal) {
  getState().goals.push(goal)
  return save()
}

export function updateGoal(id, patch) {
  const s = getState()
  const i = s.goals.findIndex((g) => g.id === id)
  if (i < 0) return Promise.resolve(false)
  s.goals[i] = typeof patch === 'function' ? patch(s.goals[i]) : { ...s.goals[i], ...patch }
  return save()
}

export function removeGoal(id) {
  const s = getState()
  s.goals = s.goals.filter((g) => g.id !== id)
  return save()
}
