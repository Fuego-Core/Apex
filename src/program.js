/* Programme préchargé au premier lancement.
   Un PROGRAMME = 5 SÉANCES, chacune avec ses exercices ordonnés. */

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Exercice en mode "reps" : le moteur de progression s'applique. */
function reps(name, opts) {
  return {
    name,
    mode: 'reps',
    sets: opts.sets,
    repMin: opts.min,
    repMax: opts.max,
    weight: opts.weight,
    increment: opts.increment ?? 2.5,
    rest: opts.rest ?? 120,
    note: opts.note ?? '',
    assisted: opts.assisted ?? false
  }
}

/** Exercice en mode "temps" : simple log de durée, pas de moteur. */
function temps(name, opts) {
  return {
    name,
    mode: 'temps',
    sets: opts.sets ?? 1,
    secMin: opts.min,
    secMax: opts.max ?? opts.min,
    weight: 0,
    increment: 0,
    rest: opts.rest ?? 0,
    note: opts.note ?? '',
    assisted: false
  }
}

const RAW = [
  {
    id: 'push',
    name: 'Push',
    subtitle: 'Pectoraux · Épaules · Triceps',
    exercises: [
      reps('Supine Press machine', { sets: 4, min: 6, max: 8, weight: 50, rest: 120 }),
      reps('Développé incliné haltères', { sets: 3, min: 8, max: 10, weight: 16, rest: 90, note: 'banc 30-45°' }),
      reps('Développé épaules machine', { sets: 3, min: 8, max: 10, weight: 19, rest: 90 }),
      reps('Élévations latérales', { sets: 4, min: 12, max: 15, weight: 8, rest: 60 }),
      reps('Dips assistés', { sets: 3, min: 8, max: 12, weight: 25, rest: 90, assisted: true, increment: 2 }),
      reps('Extension triceps corde', { sets: 3, min: 10, max: 12, weight: 11, rest: 60 }),
      temps('Marche inclinée', { min: 15 * 60 })
    ]
  },
  {
    id: 'pull',
    name: 'Pull',
    subtitle: 'Dos · Biceps',
    exercises: [
      reps('Tirage vertical prise large', { sets: 4, min: 8, max: 10, weight: 39, rest: 120, note: '45 dès exécution propre' }),
      reps('Rowing barre penché', { sets: 3, min: 8, max: 10, weight: 20, rest: 90 }),
      reps('Tirage horizontal poulie (barre courbée)', { sets: 3, min: 10, max: 12, weight: 37, rest: 90 }),
      reps('Face pull corde', { sets: 3, min: 12, max: 15, weight: 11, rest: 60 }),
      reps('Curl barre EZ', { sets: 3, min: 8, max: 10, weight: 20, rest: 60 }),
      reps('Hammer curl', { sets: 2, min: 10, max: 12, weight: 8, rest: 60 }),
      temps('Marche inclinée', { min: 15 * 60 })
    ]
  },
  {
    id: 'legs',
    name: 'Legs',
    subtitle: 'Quadriceps · Fessiers · Mollets',
    exercises: [
      reps('Hack squat', { sets: 4, min: 8, max: 10, weight: 27, rest: 150 }),
      reps('Presse à jambes', { sets: 3, min: 10, max: 12, weight: 54, rest: 120 }),
      reps('Fentes marchées', { sets: 2, min: 8, max: 12, weight: 8, rest: 90, note: 'par jambe' }),
      reps('Leg extension', { sets: 2, min: 12, max: 15, weight: 20, rest: 60 }),
      reps('Mollets debout', { sets: 4, min: 10, max: 12, weight: 10, rest: 45, note: 'pause 2 sec en bas' }),
      temps('Planche', { sets: 3, min: 45, max: 60, rest: 60 })
    ]
  },
  {
    id: 'upper',
    name: 'Upper',
    subtitle: 'Haut du corps complet',
    exercises: [
      reps('Arnold press', { sets: 3, min: 8, max: 10, weight: 12, rest: 90 }),
      reps('Élévations latérales', { sets: 4, min: 12, max: 15, weight: 8, rest: 60 }),
      reps('Tirage horizontal V-grip prise serrée', { sets: 3, min: 8, max: 10, weight: 37, rest: 90 }),
      reps('Fly arrière machine', { sets: 3, min: 12, max: 15, weight: 18, rest: 60, note: 'omoplates fixes, retenter 25 strict' }),
      reps('Skull crushers EZ', { sets: 3, min: 8, max: 10, weight: 15, rest: 60 }),
      reps('Curl incliné haltères', { sets: 3, min: 10, max: 12, weight: 6, rest: 60 }),
      temps('Marche inclinée', { min: 15 * 60 })
    ]
  },
  {
    id: 'lower',
    name: 'Lower',
    subtitle: 'Ischios · Fessiers · Gainage',
    exercises: [
      reps('Soulevé de terre roumain', { sets: 4, min: 8, max: 10, weight: 40, rest: 150 }),
      reps('Fente bulgare', { sets: 3, min: 8, max: 12, weight: 8, rest: 90, note: 'par jambe' }),
      reps('Leg curl couché', { sets: 3, min: 10, max: 12, weight: 20, rest: 90 }),
      reps('Hip thrust machine', { sets: 3, min: 10, max: 12, weight: 20, rest: 90 }),
      reps('Mollets', { sets: 4, min: 12, max: 15, weight: 9, rest: 45, note: 'pause 2 sec en bas' }),
      reps('Crunch poulie', { sets: 3, min: 12, max: 15, weight: 10, rest: 45 }),
      temps('Vélo', { min: 10 * 60 })
    ]
  }
]

/** Construit une copie fraîche du programme (ids stables et lisibles). */
export function buildProgram() {
  return RAW.map((s) => ({
    id: s.id,
    name: s.name,
    subtitle: s.subtitle,
    lastDoneAt: null,
    exercises: s.exercises.map((e, i) => ({
      id: `${s.id}-${String(i + 1).padStart(2, '0')}-${slug(e.name)}`,
      ...e,
      // Suggestion du moteur laissée par la dernière séance (pense-bête).
      pending: null
    }))
  }))
}
