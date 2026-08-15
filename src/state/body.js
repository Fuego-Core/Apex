/* Profil et mesures corporelles — mutations.

   Ces fonctions modifient le document en mémoire puis délèguent
   l'enregistrement à state/index.js. Aucune ne parle au stockage. */

import { getState, save } from './index.js'
import { upsert as upsertEntry, removeAt as removeEntryAt } from '../core/body.js'

/** Met à jour le profil (fusion), horodate, enregistre. */
export function updateProfile(patch) {
  const s = getState()
  s.profile = { ...s.profile, ...patch, updatedAt: new Date().toISOString() }
  return save()
}

/** Ajoute ou remplace une mesure du jour. `kind` = 'weight' | 'waist'. */
export function setBodyEntry(kind, { date, value, note = '' }) {
  const s = getState()
  s.body[kind] = upsertEntry(s.body[kind], { date, value, note })
  return save()
}

export function removeBodyEntry(kind, date) {
  const s = getState()
  s.body[kind] = removeEntryAt(s.body[kind], date)
  return save()
}
