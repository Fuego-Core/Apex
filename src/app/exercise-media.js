const SW = 'https://smartworkout.app/fr/bibliotheque-d-exercices'

// SmartWorkout is the single source of truth for exercise demonstrations.
// We intentionally do not hotlink third-party thumbnails: when SmartWorkout
// does not expose a stable embeddable media URL, APEX opens the exact guide.
const media = {
  'chest press machine': `${SW}/poitrine/presse-pectorale-a-la-machine`,
  'tractions assistées': `${SW}/dos/tractions-assistees`,
  'développé incliné haltères': `${SW}/poitrine/developpe-incline-avec-halteres`,
  'développé incliné': `${SW}/poitrine/developpe-incline-avec-halteres`,
  'rowing poulie assis': `${SW}/dos/rowing-assis-a-la-poulie`,
  'rowing prise serrée': `${SW}/dos/rowing-assis-a-la-poulie`,
  'élévations latérales': `${SW}/epaules/levees-laterales`,
  'dips assistés': `${SW}/triceps/dips-assistes-a-la-machine`,
  'curl incliné': `${SW}/biceps/curl-incline-assis-pour-biceps`,
  'hack squat': `${SW}/jambes/squat-hack-a-la-machine`,
  'presse à jambes': `${SW}/jambes/presse-a-cuisses`,
  'leg curl': `${SW}/jambes/flexion-des-jambes-assis-a-la-machine`,
  'fentes marchées': `${SW}/jambes/fentes-marchees`,
  'mollets': `${SW}/jambes/elevation-des-mollets-debout`,
  'crunch poulie': `${SW}/abdominaux/crunch-a-la-poulie-a-genoux`,
  'abdos': `${SW}/abdominaux/crunch-a-la-poulie-a-genoux`,
  'tirage vertical': `${SW}/dos/tirage-vertical-a-la-machine`,
  'shoulder press machine': `${SW}/epaules/presse-a-epaules-a-la-machine`,
  'reverse fly': `${SW}/epaules/butterfly-inverse`,
  'extension triceps': `${SW}/triceps/extensions-a-la-poulie`,
  'curl marteau': `${SW}/biceps/curl-prise-marteau`,
  'soulevé de terre roumain': `${SW}/jambes/souleve-de-terre-roumain-avec-halteres`,
  'fente bulgare': `${SW}/jambes/fente-bulgare`,
  'hip thrust': `${SW}/fessiers/elevation-de-bassin-avec-charge`,
  'leg extension': `${SW}/jambes/extension-des-jambes`,
  'suspension barre': `${SW}/dos`,
  'scapular pull-ups': `${SW}/dos`,
  'pompes strictes': `${SW}/poitrine/pompe`,
  'support dips': `${SW}/triceps/dips`,
  'handstand au mur': `${SW}/epaules`
}

export function exerciseMedia(name = '') {
  const page = media[String(name).trim().toLowerCase()]
  if (!page) return null
  return { source: 'SmartWorkout', page, image: null }
}
