const STORAGE = 'apex-coach-pro-v1'

export const TODAY = () => new Date().toISOString().slice(0, 10)

const INITIAL_BODY = {
  date: '2026-09-11',
  weight: 75,
  navel: 96
}

function freshState() {
  return {
    createdAt: TODAY(),
    currentWeek: 1,
    body: [{ ...INITIAL_BODY }],
    sessions: {},
    history: [],
    checkins: [],
    nutritionDays: {},
    pantry: [],
    foodLog: {}
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalize(raw) {
  const base = freshState()
  if (!isObject(raw)) return base

  return {
    ...base,
    ...raw,
    currentWeek: Number.isFinite(Number(raw.currentWeek)) ? Math.min(6, Math.max(1, Number(raw.currentWeek))) : 1,
    body: Array.isArray(raw.body) && raw.body.length ? raw.body : base.body,
    sessions: isObject(raw.sessions) ? raw.sessions : {},
    history: Array.isArray(raw.history) ? raw.history : [],
    checkins: Array.isArray(raw.checkins) ? raw.checkins : [],
    nutritionDays: isObject(raw.nutritionDays) ? raw.nutritionDays : {},
    pantry: Array.isArray(raw.pantry) ? raw.pantry : [],
    foodLog: isObject(raw.foodLog) ? raw.foodLog : {}
  }
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE) || 'null'))
  } catch {
    return freshState()
  }
}

/**
 * Objet d'état unique partagé par toutes les fonctions APEX.
 * Les modules le mutent en place puis appellent save(). Il n'existe plus de
 * seconde copie du localStorage dans le scanner ou dans les améliorations UI.
 */
export const state = load()

export function save({ scope = null } = {}) {
  localStorage.setItem(STORAGE, JSON.stringify(state))
  if (scope && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('apex:state-changed', { detail: { scope } }))
  }
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function nutritionLogTotals(date = TODAY()) {
  const rows = Array.isArray(state.foodLog?.[date]) ? state.foodLog[date] : []
  const total = rows.reduce(
    (acc, row) => {
      acc.kcal += Number(row.kcal) || 0
      acc.protein += Number(row.protein) || 0
      acc.carbs += Number(row.carbs) || 0
      acc.fat += Number(row.fat) || 0
      return acc
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  return { ...total, count: rows.length }
}

export function nutritionDay(date = TODAY()) {
  const manual = state.nutritionDays?.[date] || {}
  const scanned = nutritionLogTotals(date)
  const rounded = (key) => Math.round(scanned[key] * 10) / 10
  const automatic = scanned.count > 0

  return {
    kcal: automatic ? rounded('kcal') : (manual.kcal || ''),
    protein: automatic ? rounded('protein') : (manual.protein || ''),
    fat: automatic ? rounded('fat') : (manual.fat || ''),
    carbs: automatic ? rounded('carbs') : (manual.carbs || ''),
    scanned
  }
}
