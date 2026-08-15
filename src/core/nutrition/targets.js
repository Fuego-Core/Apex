/* CIBLES NUTRITIONNELLES.

   APEX peut proposer une estimation. Une estimation n'est pas une prescription :
   - elle n'existe que si TOUTES ses entrées sont connues ; il n'y a pas
     d'estimation « partielle » avec des valeurs par défaut inventées ;
   - elle expose ce qui a servi à la calculer, pour être discutable ;
   - une valeur saisie à la main l'emporte toujours ;
   - rien ici ne s'ajuste tout seul en fonction du poids. */

const ACTIVITY_FACTORS = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  intense: 1.725
}

/** Écart calorique par objectif, en kcal/jour. Assumés, modifiables, expliqués. */
const GOAL_ADJUSTMENT = {
  seche: -400,
  prise: 250,
  maintien: 0,
  recomp: -200
}

/** Protéines visées, en g par kg de poids corporel. */
const PROTEIN_PER_KG = {
  seche: 2,
  prise: 1.8,
  maintien: 1.6,
  recomp: 2
}

export const GOAL_LABELS = {
  seche: 'Perdre du gras',
  prise: 'Prendre du muscle',
  maintien: 'Maintenir',
  recomp: 'Recomposition'
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Métabolisme de base — Mifflin-St Jeor. */
export function basalMetabolicRate({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (sex === 'homme') return base + 5
  if (sex === 'femme') return base - 161
  return null
}

/**
 * Estimation des cibles à partir du profil et du poids réel.
 * @returns {{status:'ok', kcal, protein, carbs, fat, basis}
 *          |{status:'incomplete', missing: string[]}}
 */
export function estimateTargets({ profile, weightKg, now = new Date() } = {}) {
  const missing = []

  const sex = profile?.sex
  if (sex !== 'homme' && sex !== 'femme') missing.push('sexe')

  const height = num(profile?.height)
  if (height === null) missing.push('taille')

  const birthYear = num(profile?.birthYear)
  if (birthYear === null) missing.push('année de naissance')

  const weight = num(weightKg)
  if (weight === null) missing.push('poids')

  const activity = profile?.activity
  if (!ACTIVITY_FACTORS[activity]) missing.push('activité')

  const goal = profile?.goal
  if (!(goal in GOAL_ADJUSTMENT)) missing.push('objectif')

  // Une estimation incomplète serait une invention : on rend la liste de ce
  // qui manque, l'interface demandera ces informations précises.
  if (missing.length) return { status: 'incomplete', missing }

  const age = now.getFullYear() - birthYear
  const bmr = basalMetabolicRate({ sex, weightKg: weight, heightCm: height, age })
  const factor = ACTIVITY_FACTORS[activity]
  const maintenance = bmr * factor
  const adjustment = GOAL_ADJUSTMENT[goal]
  const kcal = Math.max(1200, Math.round((maintenance + adjustment) / 10) * 10)

  const proteinPerKg = PROTEIN_PER_KG[goal]
  const protein = Math.round(weight * proteinPerKg)
  // 25 % des calories en lipides, le reste en glucides — répartition courante,
  // pas une vérité : elle est modifiable comme le reste.
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return {
    status: 'ok',
    kcal,
    protein,
    carbs,
    fat,
    fiber: null, // aucune base sérieuse pour l'estimer : on ne l'invente pas
    basis: {
      formula: 'mifflin-st-jeor',
      sex,
      age,
      heightCm: height,
      weightKg: weight,
      activity,
      activityFactor: factor,
      goal,
      bmr: Math.round(bmr),
      maintenance: Math.round(maintenance),
      adjustmentKcal: adjustment,
      proteinPerKg,
      fatShare: 0.25
    }
  }
}

/** Phrase d'explication, pour que l'estimation soit lisible et contestable. */
export function explain(basis) {
  if (!basis) return null
  return (
    `Mifflin-St Jeor : ${basis.bmr} kcal au repos pour ${basis.weightKg} kg, ` +
    `${basis.heightCm} cm, ${basis.age} ans. × ${basis.activityFactor} d'activité ` +
    `= ${basis.maintenance} kcal d'entretien, ` +
    `${basis.adjustmentKcal === 0 ? 'sans ajustement' : `${basis.adjustmentKcal > 0 ? '+' : ''}${basis.adjustmentKcal} kcal`} ` +
    `pour l'objectif « ${GOAL_LABELS[basis.goal] || basis.goal} ». ` +
    `Protéines à ${basis.proteinPerKg} g/kg, lipides à ${Math.round(basis.fatShare * 100)} % des calories.`
  )
}

/** Cibles effectives : le manuel prime, l'estimation ne comble jamais un trou
 *  d'une saisie manuelle sans le dire. */
export function effectiveTargets(targets) {
  if (!targets || targets.mode === null) return null
  return {
    mode: targets.mode,
    kcal: num(targets.kcal),
    protein: num(targets.protein),
    carbs: num(targets.carbs),
    fat: num(targets.fat),
    fiber: num(targets.fiber)
  }
}
