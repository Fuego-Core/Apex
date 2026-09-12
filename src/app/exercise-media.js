const BF = 'https://www.basic-fit.com'
const SW = 'https://smartworkout.app/fr/bibliotheque-d-exercices'

const basicFitArticle = `${BF}/fr-fr/blog/la-premiere-fois-dans-une-salle-de-sport`
const basicFitMachines = `${BF}/fr-fr/accueil-chaleureux`

const basicFit = {
  'chest press machine': {
    page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`
  },
  'presse à jambes': {
    page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`
  },
  'tirage vertical': {
    page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`
  },
  'rowing poulie assis': {
    page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`
  },
  'rowing prise serrée': {
    page: basicFitArticle,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`
  },
  'crunch poulie': {
    page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`
  },
  'abdos': {
    page: basicFitMachines,
    image: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`
  }
}

const smartWorkout = {
  'tractions assistées': `${SW}/dos/tractions-assistees`,
  'développé incliné haltères': `${SW}/poitrine/developpe-incline-avec-halteres`,
  'développé incliné': `${SW}/poitrine/developpe-incline-avec-halteres`,
  'élévations latérales': `${SW}/epaules/levees-laterales`,
  'dips assistés': `${SW}/triceps/dips-assistes-a-la-machine`,
  'curl incliné': `${SW}/biceps/curl-incline-assis-pour-biceps`,
  'hack squat': `${SW}/jambes/squat-hack-a-la-machine`,
  'leg curl': `${SW}/jambes/flexion-des-jambes-assis-a-la-machine`,
  'fentes marchées': `${SW}/jambes/fentes-marchees`,
  'mollets': `${SW}/jambes/elevation-des-mollets-debout`,
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
  const key = String(name).trim().toLowerCase()
  if (basicFit[key]) return { source: 'Basic-Fit', ...basicFit[key] }
  const page = smartWorkout[key]
  if (!page) return null
  return { source: 'SmartWorkout', page, image: null }
}
