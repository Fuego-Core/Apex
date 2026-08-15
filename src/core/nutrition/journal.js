/* JOURNAL ALIMENTAIRE — une journée, ses repas, ses lignes.

   Une ligne de journal est autoportante : elle embarque l'instantané des
   valeurs de l'aliment au moment où elle a été enregistrée. Le catalogue peut
   changer, le cache peut disparaître, la fiche Open Food Facts peut être
   corrigée par quelqu'un d'autre : la journée du 3 août restera la journée du
   3 août. */

import { today } from '../body.js'

export const MEALS = ['petit-dejeuner', 'dejeuner', 'diner', 'collation']

export const MEAL_LABELS = {
  'petit-dejeuner': 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation'
}

/** Repas proposé par défaut selon l'heure — une suggestion, jamais un verrou. */
export function suggestedMeal(now = new Date()) {
  const h = now.getHours()
  if (h < 11) return 'petit-dejeuner'
  if (h < 15) return 'dejeuner'
  if (h < 18) return 'collation'
  return 'diner'
}

export function emptyDay(date = today()) {
  return { date, entries: [], note: '' }
}

/** La journée demandée, ou une journée vide — jamais null, pour que les vues
 *  n'aient pas à traiter ce cas. */
export function dayOf(days, date = today()) {
  return days?.[date] || emptyDay(date)
}

export function addEntry(day, entry) {
  return { ...day, entries: [...day.entries, entry] }
}

export function updateEntry(day, entryId, patch) {
  return {
    ...day,
    entries: day.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e))
  }
}

export function removeEntry(day, entryId) {
  return { ...day, entries: day.entries.filter((e) => e.id !== entryId) }
}

/** Les lignes d'un repas, dans l'ordre d'ajout. */
export function entriesOfMeal(day, meal) {
  return (day?.entries || []).filter((e) => e.meal === meal)
}

/** Les repas réellement utilisés ce jour-là, dans l'ordre de la journée. */
export function usedMeals(day) {
  const used = new Set((day?.entries || []).map((e) => e.meal))
  return MEALS.filter((m) => used.has(m))
}

/** Les N derniers jours ayant au moins une ligne, du plus récent au plus ancien. */
export function loggedDays(days, { limit = 30, from = null } = {}) {
  return Object.values(days || {})
    .filter((d) => d?.entries?.length)
    .filter((d) => (from ? d.date >= from : true))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

/** Décale une date AAAA-MM-JJ de n jours, en restant sur le calendrier local. */
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return today(d)
}

/** Nombre de jours enregistrés sur une fenêtre — pour dire « 12 jours sur 30 ». */
export function loggedCount(days, windowDays = 30, now = new Date()) {
  const from = shiftDate(today(now), -(windowDays - 1))
  return loggedDays(days, { limit: 1000, from }).length
}
