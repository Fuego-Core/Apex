import { J0 } from './config.js'

const STORAGE = 'apex-coach-pro-v1'
const SCHEMA_VERSION = 2

export function TODAY(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function freshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: TODAY(),
    currentWeek: 1,
    body: [{ ...J0 }],
    sessions: {},
    history: [],
    checkins: [],
    nutritionDays: {},
    pantry: [],
    foodLog: {},
    foodFavorites: []
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function migrate(raw) {
  if (!isObject(raw)) return raw
  const migrated = { ...raw }
  const version = Number(migrated.schemaVersion) || 1

  if (version < 2) {
    migrated.body = Array.isArray(migrated.body) ? migrated.body.map((row) => ({ ...row })) : []
    const j0Index = migrated.body.findIndex((row) => row?.date === J0.date)
    if (j0Index >= 0) migrated.body[j0Index] = { ...J0, ...migrated.body[j0Index] }
    else migrated.body.unshift({ ...J0 })
    migrated.foodFavorites = Array.isArray(migrated.foodFavorites) ? migrated.foodFavorites : []
    migrated.schemaVersion = 2
  }

  return migrated
}

function normalize(raw) {
  const base = freshState()
  if (!isObject(raw)) return base
  const migrated = migrate(raw)

  const body = Array.isArray(migrated.body) && migrated.body.length
    ? migrated.body.map((row) => row?.date === J0.date ? { ...J0, ...row } : row)
    : base.body

  return {
    ...base,
    ...migrated,
    schemaVersion: SCHEMA_VERSION,
    currentWeek: Number.isFinite(Number(migrated.currentWeek)) ? Math.min(6, Math.max(1, Number(migrated.currentWeek))) : 1,
    body,
    sessions: isObject(migrated.sessions) ? migrated.sessions : {},
    history: Array.isArray(migrated.history) ? migrated.history : [],
    checkins: Array.isArray(migrated.checkins) ? migrated.checkins : [],
    nutritionDays: isObject(migrated.nutritionDays) ? migrated.nutritionDays : {},
    pantry: Array.isArray(migrated.pantry) ? migrated.pantry : [],
    foodLog: isObject(migrated.foodLog) ? migrated.foodLog : {},
    foodFavorites: Array.isArray(migrated.foodFavorites) ? migrated.foodFavorites : []
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
 * Les modules le mutent en place puis appellent save(). La clé historique est
 * conservée ; les changements de structure passent par migrate() pour ne pas
 * perdre les données déjà enregistrées sur les appareils.
 */
export const state = load()

export function save({ scope = null } = {}) {
  state.schemaVersion = SCHEMA_VERSION
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
    version: SCHEMA_VERSION,
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
