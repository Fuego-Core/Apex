/* PROGRAMME PRÉCHARGÉ — 5 séances.

   Une séance ne définit plus des exercices : elle place des MOUVEMENTS du
   catalogue (`src/core/catalog.js`) et leur donne des paramètres de travail.

   instance = { id, exerciseId, sets, fourchette, poids, incrément, repos, note }
   Le nom, le mode et la nature assistée viennent du catalogue.

   Les valeurs ci-dessous sont celles d'APEX v1, à l'identique. */

/** Placement d'un mouvement « reps » dans une séance. */
function reps(exerciseId, opts) {
  return {
    exerciseId,
    sets: opts.sets,
    repMin: opts.min,
    repMax: opts.max,
    weight: opts.weight,
    increment: opts.increment ?? 2.5,
    rest: opts.rest ?? 120,
    note: opts.note ?? ''
  }
}

/** Placement d'un mouvement « temps » : simple log de durée, pas de moteur. */
function temps(exerciseId, opts) {
  return {
    exerciseId,
    sets: opts.sets ?? 1,
    secMin: opts.min,
    secMax: opts.max ?? opts.min,
    weight: 0,
    increment: 0,
    rest: opts.rest ?? 0,
    note: opts.note ?? ''
  }
}

const RAW = [
  {
    id: 'push',
    name: 'Push',
    subtitle: 'Pectoraux · Épaules · Triceps',
    exercises: [
      reps('supine-press-machine', { sets: 4, min: 6, max: 8, weight: 50, rest: 120 }),
      reps('incline-dumbbell-press', { sets: 3, min: 8, max: 10, weight: 16, rest: 90, note: 'banc 30-45°' }),
      reps('shoulder-press-machine', { sets: 3, min: 8, max: 10, weight: 19, rest: 90 }),
      reps('lateral-raise', { sets: 4, min: 12, max: 15, weight: 8, rest: 60 }),
      reps('assisted-dips', { sets: 3, min: 8, max: 12, weight: 25, rest: 90, increment: 2 }),
      reps('triceps-rope-extension', { sets: 3, min: 10, max: 12, weight: 11, rest: 60 }),
      temps('incline-walk', { min: 15 * 60 })
    ]
  },
  {
    id: 'pull',
    name: 'Pull',
    subtitle: 'Dos · Biceps',
    exercises: [
      reps('lat-pulldown-wide', { sets: 4, min: 8, max: 10, weight: 39, rest: 120, note: '45 dès exécution propre' }),
      reps('barbell-row', { sets: 3, min: 8, max: 10, weight: 20, rest: 90 }),
      reps('cable-row-bar', { sets: 3, min: 10, max: 12, weight: 37, rest: 90 }),
      reps('face-pull', { sets: 3, min: 12, max: 15, weight: 11, rest: 60 }),
      reps('ez-bar-curl', { sets: 3, min: 8, max: 10, weight: 20, rest: 60 }),
      reps('hammer-curl', { sets: 2, min: 10, max: 12, weight: 8, rest: 60 }),
      temps('incline-walk', { min: 15 * 60 })
    ]
  },
  {
    id: 'legs',
    name: 'Legs',
    subtitle: 'Quadriceps · Fessiers · Mollets',
    exercises: [
      reps('hack-squat', { sets: 4, min: 8, max: 10, weight: 27, rest: 150 }),
      reps('leg-press', { sets: 3, min: 10, max: 12, weight: 54, rest: 120 }),
      reps('walking-lunge', { sets: 2, min: 8, max: 12, weight: 8, rest: 90, note: 'par jambe' }),
      reps('leg-extension', { sets: 2, min: 12, max: 15, weight: 20, rest: 60 }),
      reps('standing-calf-raise', { sets: 4, min: 10, max: 12, weight: 10, rest: 45, note: 'pause 2 sec en bas' }),
      temps('plank', { sets: 3, min: 45, max: 60, rest: 60 })
    ]
  },
  {
    id: 'upper',
    name: 'Upper',
    subtitle: 'Haut du corps complet',
    exercises: [
      reps('arnold-press', { sets: 3, min: 8, max: 10, weight: 12, rest: 90 }),
      reps('lateral-raise', { sets: 4, min: 12, max: 15, weight: 8, rest: 60 }),
      reps('cable-row-vgrip', { sets: 3, min: 8, max: 10, weight: 37, rest: 90 }),
      reps('reverse-fly-machine', { sets: 3, min: 12, max: 15, weight: 18, rest: 60, note: 'omoplates fixes, retenter 25 strict' }),
      reps('skull-crusher-ez', { sets: 3, min: 8, max: 10, weight: 15, rest: 60 }),
      reps('incline-dumbbell-curl', { sets: 3, min: 10, max: 12, weight: 6, rest: 60 }),
      temps('incline-walk', { min: 15 * 60 })
    ]
  },
  {
    id: 'lower',
    name: 'Lower',
    subtitle: 'Ischios · Fessiers · Gainage',
    exercises: [
      reps('romanian-deadlift', { sets: 4, min: 8, max: 10, weight: 40, rest: 150 }),
      reps('bulgarian-split-squat', { sets: 3, min: 8, max: 12, weight: 8, rest: 90, note: 'par jambe' }),
      reps('lying-leg-curl', { sets: 3, min: 10, max: 12, weight: 20, rest: 90 }),
      reps('hip-thrust-machine', { sets: 3, min: 10, max: 12, weight: 20, rest: 90 }),
      reps('calf-raise', { sets: 4, min: 12, max: 15, weight: 9, rest: 45, note: 'pause 2 sec en bas' }),
      reps('cable-crunch', { sets: 3, min: 12, max: 15, weight: 10, rest: 45 }),
      temps('stationary-bike', { min: 10 * 60 })
    ]
  }
]

/** Construit une copie fraîche du programme (instances neuves, ids lisibles). */
export function buildProgram() {
  return RAW.map((s) => ({
    id: s.id,
    name: s.name,
    subtitle: s.subtitle,
    lastDoneAt: null,
    exercises: s.exercises.map((e, i) => ({
      id: `${s.id}-${String(i + 1).padStart(2, '0')}-${e.exerciseId}`,
      ...e,
      // Suggestion du moteur laissée par la dernière séance (pense-bête).
      pending: null
    }))
  }))
}

/** Les ids de mouvements réellement utilisés par le programme d'origine. */
export function seedExerciseIds() {
  return [...new Set(RAW.flatMap((s) => s.exercises.map((e) => e.exerciseId)))]
}
