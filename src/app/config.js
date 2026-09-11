export const J0 = {
  date: '2026-09-11',
  weight: 75,
  height: 172,
  neck: 42,
  chest: 101,
  waist: 88,
  navel: 96,
  hips: 102.5,
  armL: 31,
  armR: 31,
  thighL: 52,
  thighR: 52,
  calfL: 33.5,
  calfR: 33.5
}

export const nutritionTargets = {
  kcal: 2300,
  protein: 155,
  fat: 70,
  carbs: 250,
  creatine: '3–5 g'
}

export const mealPlan = [
  {
    time: '15:00',
    title: 'Repas 1 · Réveil',
    target: '≈ 550–600 kcal · 35–40 g protéines',
    options: [
      { name: 'Bol avoine & skyr', items: ['Flocons d’avoine 70 g', 'Skyr nature 250 g', 'Banane 120 g', 'Beurre de cacahuète 15 g'] },
      { name: 'Œufs & tartines', items: ['Œufs entiers 3', 'Pain complet 100 g', 'Skyr nature 200 g', 'Fruit 150 g'] }
    ]
  },
  {
    time: '18:00',
    title: 'Repas 2 · Avant entraînement',
    target: '≈ 550–600 kcal · 40–45 g protéines',
    options: [
      { name: 'Poulet & riz', items: ['Blanc de poulet 160 g cuit', 'Riz basmati 180 g cuit', 'Légumes 200 g', 'Huile d’olive 10 g'] },
      { name: 'Dinde & pâtes', items: ['Escalope de dinde 160 g cuite', 'Pâtes 180 g cuites', 'Sauce tomate 100 g', 'Légumes 150 g', 'Huile d’olive 5 g'] }
    ]
  },
  {
    time: '00:30',
    title: 'Repas 3 · Travail',
    target: '≈ 650–700 kcal · 45–50 g protéines',
    options: [
      { name: 'Bœuf & pommes de terre', items: ['Bœuf 5 % MG 170 g cuit', 'Pommes de terre 350 g cuites', 'Légumes 200 g', 'Huile d’olive 10 g', 'Fruit 150 g'] },
      { name: 'Poulet & semoule', items: ['Blanc de poulet 170 g cuit', 'Semoule 220 g cuite', 'Légumes 200 g', 'Huile d’olive 10 g', 'Yaourt nature 125 g'] }
    ]
  },
  {
    time: '05:30',
    title: 'Repas 4 · Après travail',
    target: '≈ 400–500 kcal · 30–35 g protéines',
    options: [
      { name: 'Skyr & céréales', items: ['Skyr nature 300 g', 'Flocons d’avoine 45 g', 'Fruits rouges 150 g', 'Amandes 15 g'] },
      { name: 'Omelette légère', items: ['Œufs entiers 2', 'Blancs d’œufs 180 g', 'Pain complet 70 g', 'Fruit 150 g'] }
    ]
  }
]

export const phases = [
  { week: 1, label: 'Reprise', rir: '3', note: 'Technique propre, aucune série forcée.' },
  { week: 2, label: 'Construction', rir: '2–3', note: 'On remonte doucement les charges.' },
  { week: 3, label: 'Progression', rir: '2', note: 'Double progression sur les mouvements principaux.' },
  { week: 4, label: 'Progression', rir: '2', note: 'Stabiliser la forme et battre les reps propres.' },
  { week: 5, label: 'Semaine forte', rir: '1–2', note: 'Effort élevé sans sacrifier la technique.' },
  { week: 6, label: 'Deload', rir: '4', note: 'Volume réduit et récupération prioritaire.' }
]

const rawSessions = [
  {
    id: 'upper-a',
    name: 'Upper A',
    subtitle: 'Pecs · Dos · Largeur',
    duration: '70–80 min',
    cardio: '15 min marche inclinée facile',
    exercises: [
      ['Chest press machine', 3, '6–8', 120, '50 kg'],
      ['Tractions assistées', 3, '6–10', 120, 'Noter aide'],
      ['Développé incliné haltères', 3, '8–10', 105, '16 kg'],
      ['Rowing poulie assis', 3, '8–12', 105, '37 kg'],
      ['Élévations latérales', 3, '12–15', 75, '8 kg'],
      ['Dips assistés', 2, '8–12', 105, '25 kg aide'],
      ['Curl incliné', 2, '10–12', 75, '6 kg']
    ]
  },
  {
    id: 'lower-a',
    name: 'Lower A',
    subtitle: 'Quadriceps · Ischios · Mollets',
    duration: '65–75 min',
    cardio: '10 min facile si récupération correcte',
    exercises: [
      ['Hack squat', 3, '8–10', 150, '27 kg'],
      ['Presse à jambes', 3, '10–12', 120, '54 kg'],
      ['Leg curl', 3, '10–12', 90, '20 kg'],
      ['Fentes marchées', 2, '10/jambe', 90, '8 kg'],
      ['Mollets', 3, '10–15', 75, '10 kg'],
      ['Crunch poulie', 3, '10–15', 60, 'À calibrer']
    ]
  },
  {
    id: 'upper-b',
    name: 'Upper B',
    subtitle: 'Dos · Épaules · Haut de pecs',
    duration: '70–80 min',
    cardio: '15 min marche inclinée facile',
    exercises: [
      ['Développé incliné', 3, '8–10', 105, 'Reprise'],
      ['Tirage vertical', 3, '8–10', 105, '39 kg'],
      ['Shoulder press machine', 3, '8–10', 105, '19 kg'],
      ['Rowing prise serrée', 3, '8–12', 105, '37 kg'],
      ['Élévations latérales', 3, '12–15', 75, '8 kg'],
      ['Reverse fly', 2, '12–15', 75, '11–25 kg'],
      ['Extension triceps', 2, '10–12', 75, '11 kg'],
      ['Curl marteau', 2, '10–12', 75, '6 kg']
    ]
  },
  {
    id: 'lower-b',
    name: 'Lower B',
    subtitle: 'Chaîne postérieure · Unilatéral',
    duration: '65–75 min',
    cardio: '10 min facile ou rien si jambes fatiguées',
    exercises: [
      ['Soulevé de terre roumain', 3, '8–10', 150, '40 kg'],
      ['Fente bulgare', 3, '8–10/jambe', 105, '8 kg'],
      ['Leg curl', 3, '10–12', 90, '20 kg'],
      ['Hip thrust', 3, '8–12', 105, '20 kg'],
      ['Leg extension', 2, '12–15', 75, '20 kg'],
      ['Mollets', 3, '12–15', 75, '9–10 kg'],
      ['Abdos', 3, '10–15', 60, 'À calibrer']
    ]
  },
  {
    id: 'skills',
    name: 'Skills',
    subtitle: 'Calisthénie technique',
    duration: '25–35 min',
    optional: true,
    cardio: 'Aucun cardio obligatoire',
    exercises: [
      ['Suspension barre', 3, '20–40 sec', 60, 'PDC'],
      ['Scapular pull-ups', 3, '6–10', 60, 'PDC'],
      ['Pompes strictes', 3, '8–15', 75, 'PDC'],
      ['Support dips', 3, '15–30 sec', 60, 'PDC'],
      ['Handstand au mur', 4, '20–30 sec', 60, 'Technique']
    ]
  }
]

export const sessions = rawSessions.map((session) => ({
  ...session,
  exercises: session.exercises.map(([name, sets, reps, rest, ref]) => ({
    name,
    sets,
    reps,
    rest,
    ref,
    cue: 'Exécution contrôlée, amplitude confortable et technique stable.'
  }))
}))
