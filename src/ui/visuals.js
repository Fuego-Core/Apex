/* VISUELS APEX — les images passent par ici, ou n'existent pas.

   Une image APEX n'est jamais une photo posée telle quelle : elle traverse le
   traitement maison (désaturation légère, contraste, voile noir, dégradé,
   lumière chaude) appliqué par le CSS de `.visual`. Résultat : des sources
   différentes appartiennent à la même application.

   Les fichiers actuels sous /images/apex/ sont des PLACEHOLDERS assumés —
   des ambiances de studio générées, pas des photos. L'architecture est prête :
   remplacer un fichier suffit, aucun code à toucher. La liste exacte des
   assets à produire vit dans public/images/apex/README.md. */

import { esc } from '../ui.js'

const ROOT = './images/apex'

/* Chaque séance a son ambiance. Un fichier = une séance ; `default` couvre
   toute séance créée plus tard. */
const HERO = {
  push: `${ROOT}/hero/push.svg`,
  pull: `${ROOT}/hero/pull.svg`,
  legs: `${ROOT}/hero/legs.svg`,
  upper: `${ROOT}/hero/upper.svg`,
  lower: `${ROOT}/hero/lower.svg`,
  default: `${ROOT}/hero/default.svg`
}

/* Les exercices partagent trois ambiances par famille de mouvement. Une photo
   dédiée par exercice pourra remplacer l'entrée de ce tableau, fichier par
   fichier, sans toucher au code. */
const EXERCISE_FAMILY = {
  press: ['supine-press-machine', 'incline-dumbbell-press', 'shoulder-press-machine', 'assisted-dips', 'triceps-rope-extension', 'bench-press', 'chest-fly-machine', 'lateral-raise'],
  pull: ['lat-pulldown', 'seated-row-machine', 'assisted-pull-up', 'biceps-curl', 'face-pull', 'rear-delt-fly', 'barbell-row', 'hammer-curl', 'shrugs'],
  legs: ['leg-press', 'leg-extension', 'leg-curl', 'hip-thrust', 'calf-raise', 'walking-lunge', 'romanian-deadlift', 'goblet-squat', 'hip-abduction', 'incline-walk', 'plank', 'crunch-machine', 'back-extension']
}

function exerciseSrc(exerciseId) {
  for (const [family, ids] of Object.entries(EXERCISE_FAMILY)) {
    if (ids.includes(exerciseId)) return `${ROOT}/exercises/${family}.svg`
  }
  return `${ROOT}/exercises/press.svg`
}

/**
 * Un visuel traité APEX.
 * @param {object} opts
 * @param {string} opts.src
 * @param {string} [opts.alt] vide pour une image décorative
 * @param {string} [opts.position] object-position CSS
 * @param {'strong'|'soft'} [opts.overlay] force du voile noir
 * @param {boolean} [opts.priority] hero : chargée en priorité, jamais lazy
 * @param {string} [opts.className]
 */
export function visual({ src, alt = '', position = 'center', overlay = 'strong', priority = false, className = '' }) {
  return `
    <div class="visual visual--${overlay} ${className}" aria-hidden="${alt ? 'false' : 'true'}">
      <img class="visual__img" src="${esc(src)}" alt="${esc(alt)}"
           style="object-position:${esc(position)}"
           ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    </div>`
}

/** Le visuel d'ambiance d'une séance (hero du tableau de bord). */
export function heroVisual(sessionId, opts = {}) {
  return visual({ src: HERO[sessionId] || HERO.default, priority: true, ...opts })
}

/** Le visuel d'un exercice — même lumière, même traitement, partout. */
export function exerciseVisual(exerciseId, opts = {}) {
  return visual({ src: exerciseSrc(exerciseId), ...opts })
}

/** Fondu d'apparition : une image ne surgit jamais brutalement.
 *  Un seul écouteur délégué pour toute l'app, posé au démarrage. */
export function initVisuals() {
  document.addEventListener(
    'load',
    (e) => {
      if (e.target instanceof HTMLImageElement && e.target.classList.contains('visual__img')) {
        e.target.closest('.visual')?.classList.add('is-loaded')
      }
    },
    true
  )
}
