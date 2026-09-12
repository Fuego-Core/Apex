const MW = 'https://musclewiki.com'

const media = {
  'tractions assistées': {
    source: 'MuscleWiki',
    page: `${MW}/exercise/machine-assisted-pull-up`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-male-Machine-machine-assisted-pull-up-side.jpg&w=3840`
  },
  'dips assistés': {
    source: 'MuscleWiki',
    page: `${MW}/exercise/machine-assisted-parallel-bar-dips`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-male-Machine-machine-assisted-parralel-bar-dips-front.jpg&w=3840`
  },
  'hack squat': {
    source: 'MuscleWiki',
    page: `${MW}/fr-fr/exercise/horizontal-hack-squat`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-male-Machine-horizontal-hack-squat-front.jpg&w=3840`
  },
  'leg curl': {
    source: 'MuscleWiki',
    page: `${MW}/exercise/machine-seated-leg-curl`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-female-Machine-machine-seated-leg-curl-front.jpg&w=3840`
  },
  'leg extension': {
    source: 'MuscleWiki',
    page: `${MW}/exercise/machine-leg-extension`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-male-machine-leg-extension-front.jpg&w=3840`
  },
  'shoulder press machine': {
    source: 'MuscleWiki',
    page: `${MW}/fr-fr/exercises/front-shoulders/machine`,
    image: `${MW}/_next/image?q=75&url=%2Fapi-next%2Fimages%2Fog-male-Machine-machine-overhand-overhead-press-front.jpg&w=3840`
  }
}

export function exerciseMedia(name = '') {
  const normalized = String(name).trim().toLowerCase()
  return media[normalized] || null
}
