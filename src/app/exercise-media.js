const BF = 'https://www.basic-fit.com'
const SW = 'https://smartworkout.app/fr/bibliotheque-d-exercices'
const MW = 'https://musclewiki.com'

const basicFitArticle = `${BF}/en-be/blog/first-time-at-the-gym`
const basicFitMachines = `${BF}/en-fr/warm-welcome`

function mw(file) {
  return `${MW}/_next/image?q=75&url=${encodeURIComponent(`/api-next/images/${file}`)}&w=640`
}

// Basic-Fit is always preferred when a stable public machine GIF exists.
// For movements whose Basic-Fit tutorial is only exposed inside their app,
// APEX keeps the Basic-Fit/SmartWorkout guide link but uses an exact movement
// thumbnail so the collapsed workout list never falls back to an empty number tile.
const media = {
  'chest press machine': {
    source: 'Basic-Fit', page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`
  },
  'presse à jambes': {
    source: 'Basic-Fit', page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`
  },
  'tirage vertical': {
    source: 'Basic-Fit', page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`
  },
  'rowing poulie assis': {
    source: 'Basic-Fit', page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`
  },
  'rowing prise serrée': {
    source: 'Basic-Fit', page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`
  },
  'crunch poulie': {
    source: 'Basic-Fit', page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`
  },
  'abdos': {
    source: 'Basic-Fit', page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`
  },

  'tractions assistées': { source:'SmartWorkout', page:`${SW}/dos/tractions-assistees`, thumbnail:mw('og-male-Machine-machine-assisted-pull-up-side.jpg') },
  'développé incliné haltères': { source:'SmartWorkout', page:`${SW}/poitrine/developpe-incline-avec-halteres`, thumbnail:mw('og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg') },
  'développé incliné': { source:'SmartWorkout', page:`${SW}/poitrine/developpe-incline-avec-halteres`, thumbnail:mw('og-male-Dumbbells-dumbbell-incline-bench-press-front.jpg') },
  'élévations latérales': { source:'SmartWorkout', page:`${SW}/epaules/levees-laterales`, thumbnail:mw('og-male-Dumbbells-dumbbell-lateral-raise-front.jpg') },
  'dips assistés': { source:'SmartWorkout', page:`${SW}/triceps/dips-assistes-a-la-machine`, thumbnail:mw('og-male-Machine-machine-assisted-parralel-bar-dips-front.jpg') },
  'curl incliné': { source:'SmartWorkout', page:`${SW}/biceps/curl-incline-assis-pour-biceps`, thumbnail:mw('og-male-Dumbbells-dumbbell-incline-curl-front.jpg') },
  'hack squat': { source:'SmartWorkout', page:`${SW}/jambes/squat-hack-a-la-machine`, thumbnail:mw('og-male-Machine-horizontal-hack-squat-front.jpg') },
  'leg curl': { source:'Basic-Fit', page:basicFitMachines, thumbnail:mw('og-female-Machine-machine-seated-leg-curl-front.jpg') },
  'fentes marchées': { source:'SmartWorkout', page:`${SW}/jambes/fentes-marchees`, thumbnail:mw('og-male-Dumbbells-dumbbell-walking-lunge-front.jpg') },
  'mollets': { source:'SmartWorkout', page:`${SW}/jambes/elevation-des-mollets-debout`, thumbnail:mw('og-male-Machine-machine-standing-calf-raise-front.jpg') },
  'shoulder press machine': { source:'SmartWorkout', page:`${SW}/epaules/presse-a-epaules-a-la-machine`, thumbnail:mw('og-male-Machine-machine-overhand-overhead-press-front.jpg') },
  'reverse fly': { source:'SmartWorkout', page:`${SW}/epaules/butterfly-inverse`, thumbnail:mw('og-male-Machine-machine-reverse-fly-front.jpg') },
  'extension triceps': { source:'SmartWorkout', page:`${SW}/triceps/extensions-a-la-poulie`, thumbnail:mw('og-male-Cables-cable-push-down-front.jpg') },
  'curl marteau': { source:'SmartWorkout', page:`${SW}/biceps/curl-prise-marteau`, thumbnail:mw('og-male-Dumbbells-dumbbell-hammer-curl-front.jpg') },
  'soulevé de terre roumain': { source:'SmartWorkout', page:`${SW}/jambes/souleve-de-terre-roumain-avec-halteres`, thumbnail:mw('og-male-Dumbbells-dumbbell-romanian-deadlift-front.jpg') },
  'fente bulgare': { source:'SmartWorkout', page:`${SW}/jambes/fente-bulgare`, thumbnail:mw('og-male-Dumbbells-dumbbell-bulgarian-split-squat-front.jpg') },
  'hip thrust': { source:'SmartWorkout', page:`${SW}/fessiers/elevation-de-bassin-avec-charge`, thumbnail:mw('og-male-Barbell-barbell-hip-thrust-front.jpg') },
  'leg extension': { source:'SmartWorkout', page:`${SW}/jambes/extension-des-jambes`, thumbnail:mw('og-male-machine-leg-extension-front.jpg') },
  'suspension barre': { source:'SmartWorkout', page:`${SW}/dos`, thumbnail:mw('og-male-Bodyweight-dead-hang-front.jpg') },
  'scapular pull-ups': { source:'SmartWorkout', page:`${SW}/dos`, thumbnail:mw('og-male-Bodyweight-scapular-pull-up-front.jpg') },
  'pompes strictes': { source:'SmartWorkout', page:`${SW}/poitrine/pompe`, thumbnail:mw('og-male-Bodyweight-push-up-front.jpg') },
  'support dips': { source:'SmartWorkout', page:`${SW}/triceps/dips`, thumbnail:mw('og-male-Bodyweight-parallel-bar-support-hold-front.jpg') },
  'handstand au mur': { source:'SmartWorkout', page:`${SW}/epaules`, thumbnail:mw('og-male-Bodyweight-wall-handstand-front.jpg') }
}

export function exerciseMedia(name = '') {
  return media[String(name).trim().toLowerCase()] || null
}
