/* Persistance : tout tient dans localStorage, en JSON, sans backend.
   - apex.v1      : programme + historique + réglages
   - apex.live.v1 : séance en cours (survit à une fermeture d'app en pleine série) */

import { buildProgram } from './program.js'

const KEY = 'apex.v1'
const LIVE_KEY = 'apex.live.v1'

function freshState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    program: buildProgram(),
    history: [],
    settings: { sound: true, vibration: true }
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.warn('APEX: lecture localStorage impossible', e)
    return fallback
  }
}

let state = migrate(read(KEY, null) || freshState())
let live = read(LIVE_KEY, null)

function migrate(s) {
  if (!s.version) s.version = 1
  if (!Array.isArray(s.program)) s.program = buildProgram()
  if (!Array.isArray(s.history)) s.history = []
  if (!s.settings) s.settings = { sound: true, vibration: true }
  for (const session of s.program) {
    for (const ex of session.exercises) {
      if (ex.pending === undefined) ex.pending = null
      if (ex.increment === undefined) ex.increment = 2.5
    }
  }
  return s
}

export function getState() {
  return state
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('APEX: écriture localStorage impossible', e)
  }
}

export function getLive() {
  return live
}

export function setLive(next) {
  live = next
  try {
    if (next) localStorage.setItem(LIVE_KEY, JSON.stringify(next))
    else localStorage.removeItem(LIVE_KEY)
  } catch (e) {
    console.warn('APEX: écriture séance en cours impossible', e)
  }
}

export function findSession(id) {
  return state.program.find((s) => s.id === id) || null
}

export function findExercise(sessionId, exerciseId) {
  const s = findSession(sessionId)
  if (!s) return null
  return s.exercises.find((e) => e.id === exerciseId) || null
}

/* ---------- Réglages / sauvegarde ---------- */

export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function importJSON(text) {
  const data = JSON.parse(text)
  if (!data || !Array.isArray(data.program)) {
    throw new Error('Fichier invalide : "program" manquant.')
  }
  state = migrate(data)
  save()
  // Une séance en cours n'a plus de sens face à un programme importé.
  setLive(null)
  return state
}

export function resetAll() {
  state = freshState()
  save()
  setLive(null)
  return state
}

export function resetProgramKeepHistory() {
  state.program = buildProgram()
  save()
  setLive(null)
  return state
}
