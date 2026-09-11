import { exerciseGuide, renderExerciseGuide } from './app/exercise-guides.js'

function enhance() {
  if (!location.hash.startsWith('#workout/')) return

  document.querySelectorAll('.exercise-card').forEach((card) => {
    const name = card.querySelector('h2')?.textContent || ''
    const guide = exerciseGuide(name)
    if (!guide) return

    card.classList.add('has-official-guide')
    card.querySelector('.exercise-cues p')?.remove()

    if (!card.querySelector('.bf-machine')) {
      const anchor = card.querySelector('.exercise-cues')
      if (!anchor) return
      anchor.insertAdjacentHTML('afterend', renderExerciseGuide(name))
    }
  })
}

window.addEventListener('apex:rendered', enhance)
enhance()
