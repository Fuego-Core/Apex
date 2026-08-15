/* Timer plein écran : repos entre les séries, ou effort chronométré (mode temps).
   Basé sur des timestamps (pas sur un compteur d'intervalles) pour rester juste
   même si l'écran s'éteint ou si l'onglet passe en arrière-plan. */

import { getState } from './state.js'
import { mmss } from './ui.js'

let audioCtx = null

function beep() {
  if (!getState().settings.sound) return
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const now = audioCtx.currentTime
    // Trois notes courtes, sèches : audible dans une salle bruyante.
    ;[0, 0.22, 0.44].forEach((offset, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1320 : 880
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.5, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    })
  } catch (e) {
    /* pas de son : tant pis, la vibration reste */
  }
}

function vibrate(pattern) {
  if (!getState().settings.vibration) return
  try {
    navigator.vibrate?.(pattern)
  } catch (e) {
    /* ignoré */
  }
}

/** Débloque l'audio au premier geste utilisateur (politique autoplay mobile). */
export function primeAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch (e) {
    /* ignoré */
  }
}

/**
 * @param {object} opts
 * @param {number} opts.seconds  durée initiale
 * @param {'repos'|'effort'} opts.kind
 * @param {string} opts.title    ligne du haut (ex. nom de l'exercice)
 * @param {string} opts.sub      ligne du bas (ex. "Série 2 · 50 kg")
 * @returns {Promise<{completed:boolean, elapsed:number}>}
 */
export function openTimer({ seconds, kind = 'repos', title = '', sub = '' }) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const el = document.createElement('div')
    el.className = `timer timer--${kind}`
    el.innerHTML = `
      <div class="timer__inner">
        <p class="timer__kicker">${kind === 'repos' ? 'REPOS' : 'EFFORT'}</p>
        <p class="timer__title">${title}</p>
        <div class="timer__dial">
          <svg viewBox="0 0 120 120" class="timer__ring" aria-hidden="true">
            <circle cx="60" cy="60" r="54" class="timer__ring-bg"/>
            <circle cx="60" cy="60" r="54" class="timer__ring-fg" data-ring/>
          </svg>
          <span class="timer__value" data-value>0:00</span>
        </div>
        <p class="timer__sub">${sub}</p>
        <div class="timer__actions">
          <button class="btn btn--ghost btn--lg" data-act="add">+30 s</button>
          <button class="btn btn--gold btn--lg" data-act="stop">${kind === 'repos' ? 'Passer' : 'Terminer'}</button>
        </div>
      </div>`

    host.appendChild(el)
    requestAnimationFrame(() => el.classList.add('is-in'))

    const valueEl = el.querySelector('[data-value]')
    const ringEl = el.querySelector('[data-ring]')
    const CIRC = 2 * Math.PI * 54
    ringEl.style.strokeDasharray = String(CIRC)

    let total = Math.max(1, Math.round(seconds))
    const startedAt = Date.now()
    let target = startedAt + total * 1000
    let finished = false
    let raf = null
    let wakeLock = null

    // Garde l'écran allumé pendant le repos, quand le navigateur le permet.
    try {
      navigator.wakeLock?.request('screen').then(
        (lock) => {
          wakeLock = lock
        },
        () => {}
      )
    } catch (e) {
      /* ignoré */
    }

    function close(completed) {
      if (raf) cancelAnimationFrame(raf)
      try {
        wakeLock?.release?.()
      } catch (e) {
        /* ignoré */
      }
      el.classList.remove('is-in')
      setTimeout(() => el.remove(), 200)
      resolve({
        completed,
        elapsed: Math.max(0, Math.round((Date.now() - startedAt) / 1000))
      })
    }

    function tick() {
      const remainingMs = target - Date.now()
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000))
      valueEl.textContent = mmss(remaining)
      // Les cinq dernières secondes s'éclairent doucement — aucun flash.
      el.classList.toggle('timer--closing', remaining <= 5 && remainingMs > 0)
      const ratio = Math.max(0, Math.min(1, remainingMs / (total * 1000)))
      ringEl.style.strokeDashoffset = String(CIRC * (1 - ratio))

      if (remainingMs <= 0 && !finished) {
        finished = true
        el.classList.add('is-done')
        valueEl.textContent = kind === 'repos' ? 'GO' : 'FINI'
        vibrate([220, 120, 220, 120, 480])
        beep()
        setTimeout(() => close(true), 900)
        return
      }
      if (!finished) raf = requestAnimationFrame(tick)
    }
    tick()

    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act
      if (!act || finished) return
      if (act === 'add') {
        target += 30000
        total += 30
        vibrate(30)
      } else if (act === 'stop') {
        close(false)
      }
    })
  })
}
