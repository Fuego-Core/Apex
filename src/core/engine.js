/* MOTEUR DE PROGRESSION DOUBLE
   Appliqué à la fin d'une séance, pour chaque exercice en mode "reps".

   - TOUTES les séries de travail au haut de la fourchette, au même poids
       => "progression" : poids + incrément la prochaine fois
   - Au moins une série SOUS le plancher
       => "trop lourd"  : poids - incrément
   - Sinon
       => "construire"  : même poids, « les reps montent d'abord »

   Exercices assistés (dips assistés) : logique inversée.
   Progresser = RÉDUIRE le poids d'assistance.

   Les séries d'échauffement sont exclues du moteur (et des stats).
*/

export const PROGRESSION = 'progression'
export const TROP_LOURD = 'trop-lourd'
export const CONSTRUIRE = 'construire'
export const LOG = 'log'

export const STATUS_LABEL = {
  [PROGRESSION]: 'Progression 🎯',
  [TROP_LOURD]: 'Trop lourd',
  [CONSTRUIRE]: 'Construire',
  [LOG]: 'Enregistré'
}

/** Séries retenues par le moteur : validées et non-échauffement. */
export function workSets(sets) {
  return (sets || []).filter((s) => s.done && !s.warmup)
}

/** Arrondi propre pour éviter 47.49999999 après additions de 2.5. */
export function round(n) {
  return Math.round(n * 100) / 100
}

/** Nombre à la française : 52.5 -> "52,5" */
function fr(n) {
  return String(round(n)).replace('.', ',')
}

/** Les séries de travail sont-elles toutes au même poids ? (règle « 1 exo = 1 poids ») */
export function isMixedWeight(sets) {
  const w = workSets(sets).map((s) => Number(s.weight) || 0)
  return new Set(w).size > 1
}

/**
 * Évalue un exercice à partir des séries réalisées.
 * @returns {{status, weightUsed, suggested, delta, title, message, mixed}}
 */
export function evaluate(exercise, sets) {
  const done = workSets(sets)
  const inc = Number(exercise.increment) || 0

  if (exercise.mode !== 'reps') {
    const total = done.reduce((a, s) => a + (Number(s.seconds) || 0), 0)
    return {
      status: LOG,
      weightUsed: 0,
      suggested: null,
      delta: 0,
      mixed: false,
      title: 'Durée enregistrée',
      message: total
        ? `${total < 60 ? `${total} s` : `${Math.round(total / 60)} min`} au total. Pas de moteur sur le mode temps.`
        : 'Pas de moteur sur le mode temps.'
    }
  }

  if (done.length === 0) {
    return {
      status: null,
      weightUsed: Number(exercise.weight) || 0,
      suggested: null,
      delta: 0,
      mixed: false,
      title: 'Non travaillé',
      message: 'Aucune série de travail validée : le poids ne bouge pas.'
    }
  }

  const mixed = isMixedWeight(done)
  const weights = done.map((s) => Number(s.weight) || 0)
  // Poids de référence : celui réellement utilisé si constant, sinon le plus lourd.
  const weightUsed = mixed ? Math.max(...weights) : weights[0]

  const allAtTop =
    !mixed &&
    done.length >= exercise.sets &&
    done.every((s) => (Number(s.reps) || 0) >= exercise.repMax)
  const anyBelowFloor = done.some((s) => (Number(s.reps) || 0) < exercise.repMin)

  // Assisté : progresser = enlever de l'assistance ; reculer = en remettre.
  const up = exercise.assisted ? -inc : inc
  const down = exercise.assisted ? inc : -inc

  if (allAtTop) {
    const suggested = Math.max(0, round(weightUsed + up))
    return {
      status: PROGRESSION,
      weightUsed,
      suggested,
      delta: round(suggested - weightUsed),
      mixed,
      title: 'Progression 🎯',
      message: exercise.assisted
        ? `Toutes les séries à ${exercise.repMax} reps : on retire ${fr(inc)} kg d'assistance → ${fr(suggested)} kg.`
        : `Toutes les séries à ${exercise.repMax} reps au même poids : on monte à ${fr(suggested)} kg.`
    }
  }

  if (anyBelowFloor) {
    const suggested = Math.max(0, round(weightUsed + down))
    return {
      status: TROP_LOURD,
      weightUsed,
      suggested,
      delta: round(suggested - weightUsed),
      mixed,
      title: 'Trop lourd',
      message: exercise.assisted
        ? `Une série sous ${exercise.repMin} reps : on remet ${fr(inc)} kg d'assistance → ${fr(suggested)} kg.`
        : `Une série sous ${exercise.repMin} reps : on redescend à ${fr(suggested)} kg pour garder la technique.`
    }
  }

  return {
    status: CONSTRUIRE,
    weightUsed,
    suggested: weightUsed,
    delta: 0,
    mixed,
    title: 'Construire',
    message: mixed
      ? 'Poids différents entre séries : on garde le même poids. Les reps montent d’abord.'
      : `On reste à ${fr(weightUsed)} kg — les reps montent d’abord, jusqu’à ${exercise.repMax} partout.`
  }
}

/** Tonnage d'un exercice : reps × poids, séries de travail uniquement.
 *  Les exercices assistés ne comptent pas (le poids soulage, il ne charge pas). */
export function tonnage(exercise, sets) {
  if (exercise.mode !== 'reps' || exercise.assisted) return 0
  return workSets(sets).reduce(
    (a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0),
    0
  )
}
