/* ÉTAT DU STOCKAGE — pour prévenir avant, pas pour constater après.

   Deux limites, très différentes, et c'est tout l'intérêt de les séparer :

   1. localStorage, où vivent TOUTES tes données (programme, historique,
      mesures, objectifs, journal alimentaire). C'est un espace petit — de
      l'ordre de 5 Mo — et une écriture qui le dépasse échoue. C'est LA limite
      qui compte, et celle qu'on surveille.
   2. Le quota général de l'appareil, où vit le cache alimentaire. Il se compte
      en gigaoctets et le cache est jetable : c'est une information, pas un
      risque.

   Les navigateurs comptent localStorage en unités UTF-16 (2 octets par
   caractère). On mesure donc en caractères puis on convertit, plutôt que
   d'annoncer un chiffre flatteur qui ne correspondrait à rien. */

/** Budget pratique de localStorage, en octets. */
export const LOCAL_LIMIT = 5 * 1024 * 1024

/** On prévient largement avant de bloquer : à 70 %, il reste du temps pour agir. */
export const WARN_AT = 0.7
export const CRITICAL_AT = 0.85

export function levelFor(ratio) {
  if (ratio === null || ratio === undefined) return 'unknown'
  if (ratio >= CRITICAL_AT) return 'critical'
  if (ratio >= WARN_AT) return 'warn'
  return 'ok'
}

/** Taille lisible. On ne descend pas sous le kilooctet : personne n'a besoin
 *  de savoir qu'un objectif pèse 412 octets. */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} Mo`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ko`
  return `${bytes} o`
}

/**
 * Ce que les données APEX occupent réellement dans localStorage, clé par clé.
 * @returns {{total, limit, ratio, level, byKey: {key, bytes, label}[]}}
 */
export function measureLocal(storage, { prefix = 'apex.', limit = LOCAL_LIMIT } = {}) {
  const byKey = []
  let total = 0

  try {
    // Même énumération que l'adapter de stockage : les clés sont des propriétés.
    for (const key of Object.keys(storage)) {
      if (!key.startsWith(prefix)) continue
      const value = storage.getItem(key) ?? ''
      // Clé et valeur comptent toutes les deux, en UTF-16.
      const bytes = (key.length + value.length) * 2
      total += bytes
      byKey.push({ key, bytes, label: labelFor(key) })
    }
  } catch (e) {
    // Stockage inaccessible (navigation privée) : on ne prétend pas mesurer.
    return { total: null, limit, ratio: null, level: 'unknown', byKey: [] }
  }

  byKey.sort((a, b) => b.bytes - a.bytes)
  const ratio = limit > 0 ? total / limit : null
  return { total, limit, ratio, level: levelFor(ratio), byKey }
}

/** Un nom lisible plutôt qu'une clé technique. */
export function labelFor(key) {
  // Les horodatages d'abord : `apex.backup.v1.at` n'est pas une sauvegarde.
  if (/\.at$/.test(key)) return 'Horodatage'
  if (/^apex\.backup\./.test(key)) return `Sauvegarde ${key.replace('apex.backup.', '')}`
  if (/^apex\.live\./.test(key)) return 'Séance en cours'
  if (/^apex\.v\d+$/.test(key)) return `Données APEX (${key.replace('apex.', '')})`
  return key
}

/** Le message à afficher, ou null si tout va bien. Jamais alarmiste sans raison. */
export function storageAdvice(local) {
  if (local.level === 'critical') {
    return {
      tone: 'danger',
      text: `Stockage presque plein (${Math.round(local.ratio * 100)} %). Exporte tes données maintenant : au-delà, une modification pourrait ne plus être enregistrée.`
    }
  }
  if (local.level === 'warn') {
    return {
      tone: 'warn',
      text: `Stockage occupé à ${Math.round(local.ratio * 100)} %. Pense à exporter tes données, et à supprimer les anciennes sauvegardes si tu n'en as plus besoin.`
    }
  }
  return null
}

/**
 * Le quota général de l'appareil. Informatif : ce qui vit là est jetable.
 * @returns {Promise<{quota, usage, ratio, persisted}>}
 */
export async function deviceEstimate() {
  const out = { quota: null, usage: null, ratio: null, persisted: null }
  try {
    const est = await navigator.storage.estimate()
    out.quota = est.quota ?? null
    out.usage = est.usage ?? null
    out.ratio = out.quota ? out.usage / out.quota : null
  } catch (e) {
    /* non mesurable : on l'affichera comme tel */
  }
  try {
    out.persisted = await navigator.storage.persisted()
  } catch (e) {
    /* idem */
  }
  return out
}
