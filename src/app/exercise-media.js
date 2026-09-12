const BF = 'https://www.basic-fit.com'

const pages = {
  welcome: `${BF}/fr-be/accueil-chaleureux`,
  pushPull: `${BF}/fr-be/blog/exercices-push-pull-debutants`,
  routine: `${BF}/fr-fr/blog/fitness-routine`,
  biceps: `${BF}/fr-be/blog/les-meilleurs-exercices-pour-tes-biceps`,
  shoulders: `${BF}/fr-fr/blog/les-meilleurs-exercices-pour-les-epaules`,
  hipThrust: `${BF}/fr-be/blog/technique-hip-thrust`,
  freeWeights: `${BF}/fr-be/blog/poids-libres-debutants`,
  first: `${BF}/fr-fr/blog/la-premiere-fois-dans-une-salle-de-sport`,
  trainingZones: `${BF}/en-be/training-zones`
}

const images = {
  chestPress: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`,
  legPress: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`,
  latPulldown: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`,
  seatedRow: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`,
  crunch: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`,
  inclinePress: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw83cd8400/Square-Generated%20image%20%281%29.jpg?sw=560`,
  shoulderPress: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw13c166fb/Square-Generated%20image%20%282%29.jpg?sw=560`,
  pullup: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw8e9068c6/Square-Basicfit%20Breda%20Sem%2014-11-252720.jpg?sw=560`,
  hipThrust: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw80df320f/Blogs/Hip%20thrust/Landscape-Basic%20Fit%20Almere%2024-10-221543.jpg?sw=968`,
  legExtension: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw0fd02af1/1.%20new%20VI%20images/Training%20zone%20pages/Landscape-Basicfit%20Breda%20Roel%2014-11-250275%20%281%29.jpg?sw=600`,
  squat: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw8498e6e5/1.%20new%20VI%20images/Training%20zone%20pages/Square-Basicfit%20-%20New%20visual%20identity%209-7-251341%201.jpg?sw=600`,
  dumbbellCurl: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw52bdac29/Blogs/GIFs%20for%20biceps/dumbbellbicepcurlEDITED-ezgif.com-optimize%20%281%29.gif`,
  straightBarCurl: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc811438f/Blogs/GIFs%20for%20biceps/StraightbarcurlEDITED-ezgif.com-optimize.gif`,
  shoulders: `${BF}/dw/image/v2/BDFP_PRD/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1d9f5120/Roots/Blog/Blog-Header/528x352/18-05-Blog-Fitness-Training-Shoulders.jpg?sw=968`,
  freeWeights: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw253cbac3/Blogs/Free%20weights%20blog/people%20training%20new%20vi.jpg`,
  cable: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc57c63c7/Landscape-Basicfit%20Breda%20Roel%2014-11-250971.jpg`
}

// Every programmed movement is mapped intentionally to the closest verified
// Basic-Fit visual. No generic chest/leg fallback is used anymore.
const media = {
  'chest press machine': { image: images.chestPress, page: pages.welcome },
  'tractions assistées': { image: images.pullup, page: pages.biceps },
  'développé incliné haltères': { image: images.inclinePress, page: pages.routine },
  'développé incliné': { image: images.inclinePress, page: pages.routine },
  'rowing poulie assis': { image: images.seatedRow, page: pages.pushPull },
  'rowing prise serrée': { image: images.seatedRow, page: pages.pushPull },
  'élévations latérales': { image: images.shoulders, page: pages.shoulders },
  'dips assistés': { image: images.pullup, page: pages.pushPull },
  'curl incliné': { image: images.dumbbellCurl, page: pages.biceps },
  'hack squat': { image: images.squat, page: pages.routine },
  'presse à jambes': { image: images.legPress, page: pages.welcome },
  'leg curl': { image: images.legExtension, page: pages.welcome },
  'fentes marchées': { image: images.freeWeights, page: pages.routine },
  'mollets': { image: images.squat, page: pages.routine },
  'crunch poulie': { image: images.crunch, page: pages.welcome },
  'abdos': { image: images.crunch, page: pages.welcome },
  'tirage vertical': { image: images.latPulldown, page: pages.welcome },
  'shoulder press machine': { image: images.shoulderPress, page: pages.pushPull },
  'reverse fly': { image: images.seatedRow, page: pages.routine },
  'extension triceps': { image: images.cable, page: pages.pushPull },
  'curl marteau': { image: images.dumbbellCurl, page: pages.biceps },
  'soulevé de terre roumain': { image: images.freeWeights, page: pages.freeWeights },
  'fente bulgare': { image: images.freeWeights, page: pages.routine },
  'hip thrust': { image: images.hipThrust, page: pages.hipThrust },
  'leg extension': { image: images.legExtension, page: pages.trainingZones },
  'suspension barre': { image: images.pullup, page: pages.biceps },
  'scapular pull-ups': { image: images.pullup, page: pages.biceps },
  'pompes strictes': { image: images.inclinePress, page: pages.pushPull },
  'support dips': { image: images.pullup, page: pages.pushPull },
  'handstand au mur': { image: images.shoulders, page: pages.shoulders }
}

export function exerciseMedia(name = '') {
  const entry = media[String(name).trim().toLowerCase()]
  return entry ? { source: 'Basic-Fit', ...entry } : null
}
