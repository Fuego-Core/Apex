const STORAGE = 'apex-coach-pro-v1'

export function TODAY(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

export function exportState() {
  return {
    format: 'apex-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: clone(state)
  }
}

export function restoreState(payload) {
  const raw = payload?.format === 'apex-backup' && isObject(payload.data) ? payload.data : payload
  if (!isObject(raw)) throw new Error('Sauvegarde APEX invalide.')
  const restored = normalize(raw)
  Object.keys(state).forEach((key) => delete state[key])
  Object.assign(state, restored)
  save({ scope: 'restore' })
  return state
}

function logRows(date) {
  return Array.isArray(state.foodLog?.[date]) ? state.foodLog[date] : []
}

export function nutritionLogTotals(date = TODAY()) {
  const rows = logRows(date)
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

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function hasManualNutrition(manual) {
  return ['kcal', 'protein', 'fat', 'carbs'].some((key) => manual?.[key] !== undefined && manual[key] !== '')
}

export function nutritionDay(date = TODAY()) {
  const manual = state.nutritionDays?.[date] || {}
  const rows = logRows(date)
  const scanned = nutritionLogTotals(date)
  const rounded = (key) => Math.round(scanned[key] * 10) / 10
  const latestScan = rows.reduce((latest, row) => Math.max(latest, timestamp(row.at)), 0)
  const manualSavedAt = timestamp(manual.updatedAt)
  const manualExists = hasManualNutrition(manual)

  // Une saisie manuelle effectuée après le dernier aliment journalisé est une
  // correction volontaire. Un nouvel aliment scanné après cette correction
  // reprend automatiquement la priorité, sans laisser de total périmé.
  const useManual = manualExists && (!scanned.count || manualSavedAt >= latestScan)
  const source = useManual ? 'manual' : scanned.count ? 'scanner' : 'empty'

  return {
    kcal: useManual ? (manual.kcal || '') : scanned.count ? rounded('kcal') : '',
    protein: useManual ? (manual.protein || '') : scanned.count ? rounded('protein') : '',
    fat: useManual ? (manual.fat || '') : scanned.count ? rounded('fat') : '',
    carbs: useManual ? (manual.carbs || '') : scanned.count ? rounded('carbs') : '',
    scanned,
    source
  }
}
