const SW = 'https://smartworkout.app/fr/bibliotheque-d-exercices'
const MW = 'https://musclewiki.com'

// SmartWorkout is now the single demo/reference destination for the programmed
// movements. Existing external thumbnails are kept only as an inline preview
// until SmartWorkout exposes stable, hotlinkable media URLs.
const media = {
  'chest press machine': {
    page: `${SW}/poitrine/presse-pectorale-a-la-machine`,
    preview: null
  },
  'tractions assistées': {
    page: `${SW}/dos/tractions-assistees`,
    preview: 'og-male-Machine-machine-assisted-pull-up-side.jpg'
  },
  'développé incliné haltères': {
    page: `${SW}/poitrine/developpe-incline-avec-halteres`,
    preview: 'og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg'
  },
  'rowing poulie assis': {
    page: `${SW}/dos/rowing-assis-a-la-poulie`,
    preview: null
  },
  'élévations latérales': {
    page: `${SW}/epaules/levees-laterales`,
    preview: 'og-male-Dumbbells-dumbbell-lateral-raise-front.jpg'
  },
  'dips assistés': {
    page: `${SW}/triceps/dips-assistes-a-la-machine`,
    preview: 'og-male-Machine-machine-assisted-parralel-bar-dips-front.jpg'
  },
  'curl incliné': {
    page: `${SW}/biceps/curl-incline-assis-pour-biceps`,
    preview: 'og-male-Dumbbells-dumbbell-incline-curl-front.jpg'
  },
  'hack squat': {
    page: `${SW}/jambes/squat-hack-a-la-machine`,
    preview: 'og-male-Machine-horizontal-hack-squat-front.jpg'
  },
  'presse à jambes': {
    page: `${SW}/jambes/presse-a-cuisses`,
    preview: null
  },
  'leg curl': {
    page: `${SW}/jambes/flexion-des-jambes-assis-a-la-machine`,
    preview: 'og-female-Machine-machine-seated-leg-curl-front.jpg'
  },
  'fentes marchées': {
    page: `${SW}/jambes/fentes-marchees`,
    preview: 'og-male-Dumbbells-dumbbell-walking-lunge-front.jpg'
  },
  'mollets': {
    page: `${SW}/jambes/elevation-des-mollets-debout`,
    preview: 'og-male-Machine-machine-standing-calf-raise-front.jpg'
  },
  'crunch poulie': {
    page: `${SW}/abdominaux/crunch-a-la-poulie-a-genoux`,
    preview: null
  },
  'abdos': {
    page: `${SW}/abdominaux/crunch-a-la-poulie-a-genoux`,
    preview: null
  },
  'développé incliné': {
    page: `${SW}/poitrine/developpe-incline-avec-halteres`,
    preview: 'og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg'
  },
  'tirage vertical': {
    page: `${SW}/dos/tirage-vertical-a-la-machine`,
    preview: null
  },
  'shoulder press machine': {
    page: `${SW}/epaules/presse-a-epaules-a-la-machine`,
    preview: 'og-male-Machine-machine-overhand-overhead-press-front.jpg'
  },
  'rowing prise serrée': {
    page: `${SW}/dos/rowing-assis-a-la-poulie`,
    preview: null
  },
  'reverse fly': {
    page: `${SW}/epaules/butterfly-inverse`,
    preview: 'og-male-Machine-machine-reverse-fly-front.jpg'
  },
  'extension triceps': {
    page: `${SW}/triceps/extensions-a-la-poulie`,
    preview: 'og-male-Cables-cable-push-down-front.jpg'
  },
  'curl marteau': {
    page: `${SW}/biceps/curl-prise-marteau`,
    preview: 'og-male-Dumbbells-dumbbell-hammer-curl-front.jpg'
  },
  'soulevé de terre roumain': {
    page: `${SW}/jambes/souleve-de-terre-roumain-avec-halteres`,
    preview: 'og-male-Dumbbells-dumbbell-romanian-deadlift-front.jpg'
  },
  'fente bulgare': {
    page: `${SW}/jambes/fente-bulgare`,
    preview: 'og-male-Dumbbells-dumbbell-bulgarian-split-squat-front.jpg'
  },
  'hip thrust': {
    page: `${SW}/fessiers/elevation-de-bassin-avec-charge`,
    preview: 'og-male-Barbell-barbell-hip-thrust-front.jpg'
  },
  'leg extension': {
    page: `${SW}/jambes/extension-des-jambes`,
    preview: 'og-male-machine-leg-extension-front.jpg'
  },
  'suspension barre': {
    page: `${SW}/dos`,
    preview: 'og-male-Bodyweight-dead-hang-front.jpg'
  },
  'scapular pull-ups': {
    page: `${SW}/dos`,
    preview: 'og-male-Bodyweight-scapular-pull-up-front.jpg'
  },
  'pompes strictes': {
    page: `${SW}/poitrine/pompe`,
    preview: 'og-male-Bodyweight-push-up-front.jpg'
  },
  'support dips': {
    page: `${SW}/triceps/dips`,
    preview: 'og-male-Bodyweight-parallel-bar-support-hold-front.jpg'
  },
  'handstand au mur': {
    page: `${SW}/epaules`,
    preview: 'og-male-Bodyweight-wall-handstand-front.jpg'
  }
}

function previewUrl(file) {
  if (!file) return null
  return `${MW}/_next/image?q=75&url=${encodeURIComponent(`/api-next/images/${file}`)}&w=3840`
}

export function exerciseMedia(name = '') {
  const normalized = String(name).trim().toLowerCase()
  const entry = media[normalized]
  if (!entry) return null
  return {
    source: entry.preview ? 'SmartWorkout · aperçu externe' : 'SmartWorkout',
    page: entry.page,
    image: previewUrl(entry.preview)
  }
}
