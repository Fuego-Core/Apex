/* « Qu'est-ce que je fais aujourd'hui ? »

   APEX ne connaît pas ton agenda et ne prétend pas le deviner. Il applique une
   règle simple et vérifiable : une séance en cours passe avant tout, sinon
   c'est la séance la moins récemment faite qui remonte — jamais faite d'abord.
   L'ordre du programme départage les ex æquo. */

const time = (iso) => (iso ? Date.parse(iso) : null)

/**
 * @returns {{session, reason: 'reprise'|'jamais-faite'|'la-plus-ancienne', daysSince: number|null}|null}
 */
export function nextSession(program, { live = null, now = new Date() } = {}) {
  if (!Array.isArray(program) || !program.length) return null

  if (live?.sessionId) {
    const session = program.find((s) => s.id === live.sessionId)
    if (session) return { session, reason: 'reprise', daysSince: null }
  }

  const never = program.find((s) => !s.lastDoneAt)
  if (never) return { session: never, reason: 'jamais-faite', daysSince: null }

  const oldest = program.reduce((a, b) => (time(a.lastDoneAt) <= time(b.lastDoneAt) ? a : b))
  const days = Math.floor((now.getTime() - time(oldest.lastDoneAt)) / 86400000)
  return { session: oldest, reason: 'la-plus-ancienne', daysSince: Math.max(0, days) }
}

/** Séances réalisées sur les 7 derniers jours (pour la ligne « cette semaine »). */
export function sessionsThisWeek(history, now = new Date()) {
  const since = now.getTime() - 7 * 86400000
  return (history || []).filter((h) => Date.parse(h.startedAt) >= since).length
}

/** Durée moyenne d'une séance, en secondes, sur les dernières séances archivées. */
export function averageDuration(history, sample = 5) {
  const list = (history || []).slice(0, sample).filter((h) => Number.isFinite(Number(h.durationSec)))
  if (!list.length) return null
  return Math.round(list.reduce((a, h) => a + Number(h.durationSec), 0) / list.length)
}

/**
 * Durée estimée d'une séance, en secondes. Estimation assumée : ~45 s d'effort
 * par série plus le repos prévu. Sert à situer l'ordre de grandeur, pas à
 * promettre une durée — l'app affiche « ~ ».
 */
export function estimateDuration(session) {
  if (!session?.exercises?.length) return null
  return session.exercises.reduce((total, ex) => {
    const sets = Number(ex.sets) || 0
    if (ex.mode === 'temps') return total + sets * ((Number(ex.secMax) || 0) + (Number(ex.rest) || 0))
    return total + sets * (45 + (Number(ex.rest) || 0))
  }, 0)
}

/** Nombre de suggestions du moteur en attente sur une séance. */
export function pendingCount(session) {
  return (session?.exercises || []).filter((e) => e.pending && e.pending.delta !== 0).length
}
