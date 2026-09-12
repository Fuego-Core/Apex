const BF = 'https://www.basic-fit.com'

const pages = {
  welcome: `${BF}/fr-be/accueil-chaleureux`,
  pushPull: `${BF}/fr-be/blog/exercices-push-pull-debutants`,
  routine: `${BF}/fr-fr/blog/fitness-routine`,
  legs: `${BF}/fr-be/blog/les-meilleurs-exercices-pour-les-jambes`,
  hipThrust: `${BF}/fr-be/blog/technique-hip-thrust`,
  first: `${BF}/fr-fr/blog/la-premiere-fois-dans-une-salle-de-sport`
}

const images = {
  chestPress: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`,
  legPress: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`,
  latPulldown: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`,
  seatedRow: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`,
  crunch: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`
}

// Basic-Fit only. When Basic-Fit does not expose a public exact media asset,
// APEX intentionally reuses the closest Basic-Fit machine/movement family.
// This guarantees a Basic-Fit visual for every programmed exercise.
const media = {
  'chest press machine': { image: images.chestPress, page: pages.first },
  'tractions assistées': { image: images.latPulldown, page: pages.pushPull },
  'développé incliné haltères': { image: images.chestPress, page: pages.routine },
  'développé incliné': { image: images.chestPress, page: pages.routine },
  'rowing poulie assis': { image: images.seatedRow, page: pages.first },
  'rowing prise serrée': { image: images.seatedRow, page: pages.pushPull },
  'élévations latérales': { image: images.chestPress, page: pages.routine },
  'dips assistés': { image: images.chestPress, page: pages.pushPull },
  'curl incliné': { image: images.seatedRow, page: pages.routine },
  'hack squat': { image: images.legPress, page: pages.routine },
  'presse à jambes': { image: images.legPress, page: pages.legs },
  'leg curl': { image: images.legPress, page: pages.welcome },
  'fentes marchées': { image: images.legPress, page: pages.routine },
  'mollets': { image: images.legPress, page: pages.legs },
  'crunch poulie': { image: images.crunch, page: pages.welcome },
  'abdos': { image: images.crunch, page: pages.welcome },
  'tirage vertical': { image: images.latPulldown, page: pages.pushPull },
  'shoulder press machine': { image: images.chestPress, page: pages.pushPull },
  'reverse fly': { image: images.seatedRow, page: pages.routine },
  'extension triceps': { image: images.chestPress, page: pages.routine },
  'curl marteau': { image: images.seatedRow, page: pages.routine },
  'soulevé de terre roumain': { image: images.legPress, page: pages.routine },
  'fente bulgare': { image: images.legPress, page: pages.routine },
  'hip thrust': { image: images.legPress, page: pages.hipThrust },
  'leg extension': { image: images.legPress, page: pages.routine },
  'suspension barre': { image: images.latPulldown, page: pages.pushPull },
  'scapular pull-ups': { image: images.latPulldown, page: pages.pushPull },
  'pompes strictes': { image: images.chestPress, page: pages.pushPull },
  'support dips': { image: images.chestPress, page: pages.pushPull },
  'handstand au mur': { image: images.chestPress, page: pages.pushPull }
}

function familyFallback(key) {
  if (/crunch|abdo/.test(key)) return { image: images.crunch, page: pages.welcome }
  if (/row|curl|reverse|tirage horizontal/.test(key)) return { image: images.seatedRow, page: pages.pushPull }
  if (/traction|pulldown|tirage vertical|suspension|scapular/.test(key)) return { image: images.latPulldown, page: pages.pushPull }
  if (/jambe|leg|squat|fente|mollet|roumain|hip thrust|extension/.test(key)) return { image: images.legPress, page: pages.legs }
  return { image: images.chestPress, page: pages.pushPull }
}

export function exerciseMedia(name = '') {
  const key = String(name).trim().toLowerCase()
  const entry = media[key] || familyFallback(key)
  return { source: 'Basic-Fit', ...entry }
}
