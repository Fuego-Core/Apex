const MW = 'https://musclewiki.com'

// Visual fallback library. Basic-Fit media declared directly in exercise-guides.js
// always wins. These entries make every remaining programmed movement visual.
const media = {
  'tractions assistées': ['machine-assisted-pull-up', 'og-male-Machine-machine-assisted-pull-up-side.jpg'],
  'dips assistés': ['machine-assisted-parallel-bar-dips', 'og-male-Machine-machine-assisted-parralel-bar-dips-front.jpg'],
  'développé incliné haltères': ['dumbbell-incline-bench-press', 'og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg'],
  'développé incliné': ['dumbbell-incline-bench-press', 'og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg'],
  'élévations latérales': ['dumbbell-lateral-raise', 'og-male-Dumbbells-dumbbell-lateral-raise-front.jpg'],
  'curl incliné': ['dumbbell-incline-curl', 'og-male-Dumbbells-dumbbell-incline-curl-front.jpg'],
  'hack squat': ['horizontal-hack-squat', 'og-male-Machine-horizontal-hack-squat-front.jpg'],
  'leg curl': ['machine-seated-leg-curl', 'og-female-Machine-machine-seated-leg-curl-front.jpg'],
  'fentes marchées': ['dumbbell-walking-lunge', 'og-male-Dumbbells-dumbbell-walking-lunge-front.jpg'],
  'mollets': ['machine-standing-calf-raise', 'og-male-Machine-machine-standing-calf-raise-front.jpg'],
  'shoulder press machine': ['machine-overhand-overhead-press', 'og-male-Machine-machine-overhand-overhead-press-front.jpg'],
  'reverse fly': ['machine-reverse-fly', 'og-male-Machine-machine-reverse-fly-front.jpg'],
  'extension triceps': ['cable-push-down', 'og-male-Cables-cable-push-down-front.jpg'],
  'curl marteau': ['dumbbell-hammer-curl', 'og-male-Dumbbells-dumbbell-hammer-curl-front.jpg'],
  'soulevé de terre roumain': ['dumbbell-romanian-deadlift', 'og-male-Dumbbells-dumbbell-romanian-deadlift-front.jpg'],
  'fente bulgare': ['dumbbell-bulgarian-split-squat', 'og-male-Dumbbells-dumbbell-bulgarian-split-squat-front.jpg'],
  'hip thrust': ['barbell-hip-thrust', 'og-male-Barbell-barbell-hip-thrust-front.jpg'],
  'leg extension': ['machine-leg-extension', 'og-male-machine-leg-extension-front.jpg'],
  'suspension barre': ['dead-hang', 'og-male-Bodyweight-dead-hang-front.jpg'],
  'scapular pull-ups': ['scapular-pull-up', 'og-male-Bodyweight-scapular-pull-up-front.jpg'],
  'pompes strictes': ['push-up', 'og-male-Bodyweight-push-up-front.jpg'],
  'support dips': ['parallel-bar-support-hold', 'og-male-Bodyweight-parallel-bar-support-hold-front.jpg'],
  'handstand au mur': ['wall-handstand', 'og-male-Bodyweight-wall-handstand-front.jpg']
}

function imageUrl(file) {
  return `${MW}/_next/image?q=75&url=${encodeURIComponent(`/api-next/images/${file}`)}&w=3840`
}

export function exerciseMedia(name = '') {
  const normalized = String(name).trim().toLowerCase()
  const entry = media[normalized]
  if (!entry) return null
  const [slug, image] = entry
  return {
    source: 'MuscleWiki',
    page: `${MW}/exercise/${slug}`,
    image: imageUrl(image)
  }
}
