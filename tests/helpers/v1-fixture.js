/* État APEX v1 réaliste : un programme touché par l'utilisateur (poids montés,
   note ajoutée, exercice inconnu du catalogue) et deux séances archivées, dont
   des élévations latérales faites en Push ET en Upper. */

export function v1State() {
  return {
    version: 1,
    createdAt: '2026-06-01T08:00:00.000Z',
    program: [
      {
        id: 'push',
        name: 'Push',
        subtitle: 'Pectoraux · Épaules · Triceps',
        lastDoneAt: '2026-08-10T18:30:00.000Z',
        exercises: [
          {
            id: 'push-01-supine-press-machine',
            name: 'Supine Press machine',
            mode: 'reps',
            sets: 4,
            repMin: 6,
            repMax: 8,
            weight: 55,
            increment: 2.5,
            rest: 120,
            note: 'coudes serrés',
            assisted: false,
            pending: {
              status: 'progression',
              from: 55,
              suggested: 57.5,
              delta: 2.5,
              message: 'Toutes les séries à 8 reps',
              at: '2026-08-10T19:20:00.000Z'
            }
          },
          {
            id: 'push-04-elevations-laterales',
            name: 'Élévations latérales',
            mode: 'reps',
            sets: 4,
            repMin: 12,
            repMax: 15,
            weight: 10,
            increment: 2.5,
            rest: 60,
            note: '',
            assisted: false,
            pending: null
          },
          {
            id: 'push-05-dips-assistes',
            name: 'Dips assistés',
            mode: 'reps',
            sets: 3,
            repMin: 8,
            repMax: 12,
            weight: 21,
            increment: 2,
            rest: 90,
            note: '',
            assisted: true,
            pending: null
          },
          {
            id: 'push-07-marche-inclinee',
            name: 'Marche inclinée',
            mode: 'temps',
            sets: 1,
            secMin: 900,
            secMax: 900,
            weight: 0,
            increment: 0,
            rest: 0,
            note: '',
            assisted: false,
            pending: null
          }
        ]
      },
      {
        id: 'upper',
        name: 'Upper',
        subtitle: 'Haut du corps complet',
        lastDoneAt: '2026-08-12T18:00:00.000Z',
        exercises: [
          {
            id: 'upper-02-elevations-laterales',
            name: 'Élévations latérales',
            mode: 'reps',
            sets: 4,
            repMin: 12,
            repMax: 15,
            weight: 9,
            increment: 2.5,
            rest: 60,
            note: '',
            assisted: false,
            pending: null
          },
          {
            id: 'upper-08-tirage-nuque-maison',
            name: 'Tirage nuque maison',
            mode: 'reps',
            sets: 3,
            repMin: 10,
            repMax: 12,
            weight: 30,
            increment: 5,
            rest: 60,
            note: 'exercice ajouté à la main',
            assisted: false,
            pending: null
          }
        ]
      }
    ],
    history: [
      {
        id: 'h_1',
        sessionId: 'upper',
        sessionName: 'Upper',
        startedAt: '2026-08-12T18:00:00.000Z',
        endedAt: '2026-08-12T19:05:00.000Z',
        durationSec: 3900,
        tonnage: 1420,
        entries: [
          {
            exerciseId: 'upper-02-elevations-laterales',
            name: 'Élévations latérales',
            mode: 'reps',
            assisted: false,
            repMin: 12,
            repMax: 15,
            status: 'construire',
            weightUsed: 9,
            suggested: 9,
            record: false,
            sets: [
              { warmup: false, done: true, reps: 14, weight: 9, seconds: null },
              { warmup: false, done: true, reps: 13, weight: 9, seconds: null }
            ]
          }
        ]
      },
      {
        id: 'h_2',
        sessionId: 'push',
        sessionName: 'Push',
        startedAt: '2026-08-10T18:30:00.000Z',
        endedAt: '2026-08-10T19:20:00.000Z',
        durationSec: 3000,
        tonnage: 2100,
        entries: [
          {
            exerciseId: 'push-04-elevations-laterales',
            name: 'Élévations latérales',
            mode: 'reps',
            assisted: false,
            repMin: 12,
            repMax: 15,
            status: 'progression',
            weightUsed: 8,
            suggested: 10,
            record: true,
            sets: [
              { warmup: false, done: true, reps: 15, weight: 8, seconds: null },
              { warmup: false, done: true, reps: 15, weight: 8, seconds: null }
            ]
          },
          {
            exerciseId: 'push-01-supine-press-machine',
            name: 'Supine Press machine',
            mode: 'reps',
            assisted: false,
            repMin: 6,
            repMax: 8,
            status: 'progression',
            weightUsed: 55,
            suggested: 57.5,
            record: true,
            sets: [{ warmup: false, done: true, reps: 8, weight: 55, seconds: null }]
          }
        ]
      }
    ],
    settings: { sound: false, vibration: true }
  }
}

export function v1Live() {
  return {
    sessionId: 'push',
    startedAt: '2026-08-14T17:00:00.000Z',
    entries: [
      {
        exerciseId: 'push-01-supine-press-machine',
        sets: [{ warmup: false, done: true, reps: 8, weight: 55, seconds: null }]
      }
    ]
  }
}
