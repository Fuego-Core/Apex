import './styles.css'
import './enhancements.js'
import './basicfit-media.js'
import './nutrition-scanner.js'

import { J0, mealPlan, nutritionTargets, phases, sessions } from './app/config.js'
import { TODAY, clone, nutritionDay, save, state } from './app/store.js'

let timerHandle = null
let timerRemaining = 0

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char])
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'
}

function sessionKey(id) {
  return `${state.currentWeek}:${id}`
}

function workoutState(id) {
  state.sessions[sessionKey(id)] ||= {
    exercises: {},
    completed: false,
    startedAt: null,
    cardio: false,
    notes: ''
  }
  return state.sessions[sessionKey(id)]
}

function isDone(id) {
  return !!state.sessions[sessionKey(id)]?.completed
}

function phase() {
  return phases[state.currentWeek - 1] || phases[0]
}

function mandatoryDone() {
  return sessions.filter((session) => !session.optional && isDone(session.id)).length
}

function nextSession() {
  return sessions.filter((session) => !session.optional).find((session) => !isDone(session.id)) || sessions[0]
}

function icon(name) {
  const paths = {
    home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
    program: 'M5 6h14M5 12h14M5 18h14',
    nutrition: 'M12 3v18M6 7h12',
    progress: 'M4 18l5-6 4 3 7-9',
    checkin: 'm5 12 4 4 10-10'
  }
  return `<svg viewBox="0 0 24 24"><path d="${paths[name] || paths.home}"/></svg>`
}

function nav(active) {
  const items = [
    ['home', 'home', 'Aujourd’hui'],
    ['program', 'program', 'Programme'],
    ['nutrition', 'nutrition', 'Nutrition'],
    ['progress', 'progress', 'Progrès'],
    ['checkin', 'checkin', 'Check-in']
  ]

  return `<nav class="bottom-nav">${items.map(([route, glyph, label]) => `
    <button data-nav="${route}" class="nav-item ${active === route ? 'active' : ''}">
      ${icon(glyph)}<span>${label}</span>
    </button>`).join('')}</nav>`
}

function announceRender(route) {
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent('apex:rendered', { detail: { route } }))
  })
}

function shell(html, active) {
  document.querySelector('#app').innerHTML = `
    <div class="app-shell">
      <main class="content">${html}</main>
      ${nav(active)}
    </div>`

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.onclick = () => go(button.dataset.nav)
  })
  announceRender(active)
}

function top(title, subtitle = '') {
  return `<header class="page-head">
    <div>
      <p class="brandline">APEX</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="profile-dot">F</div>
  </header>`
}

function section(title) {
  return `<div class="section-head"><h2>${title}</h2></div>`
}

function coach(title, text) {
  return `<article class="coach-card">
    <div class="coach-mark">A</div>
    <div><strong>${title}</strong><p>${text}</p></div>
  </article>`
}

function home() {
  const session = nextSession()
  const currentPhase = phase()
  const completed = mandatoryDone()
  const finished = completed === 4
  const body = state.body.at(-1) || J0

  shell(`
    ${top('Aujourd’hui', `Semaine ${state.currentWeek} · ${currentPhase.label}`)}
    <section class="today-card">
      <div class="today-main">
        <p class="kicker">${finished ? 'SEMAINE TERMINÉE' : 'PROCHAINE SÉANCE'}</p>
        <h2>${finished ? 'Récupération' : session.name}</h2>
        <p class="muted">${finished ? 'Les 4 séances principales sont faites.' : session.subtitle}</p>
        ${!finished ? `
          <div class="meta-row"><span>${session.duration}</span><span>${session.exercises.length} exercices</span></div>
          <button class="btn btn-primary" id="start">Commencer</button>
        ` : state.currentWeek < 6 ? '<button class="btn btn-primary" id="advance">Semaine suivante</button>' : ''}
      </div>
      <div class="progress-ring" style="--value:${completed * 25}">
        <div><strong>${completed}/4</strong><span>séances</span></div>
      </div>
    </section>

    <div class="metric-grid">
      <article class="metric"><span>Poids</span><strong>${num(body.weight)} kg</strong><small>J0 75 kg</small></article>
      <article class="metric"><span>Nombril</span><strong>${num(body.navel)} cm</strong><small>J0 96 cm</small></article>
      <article class="metric"><span>RIR cible</span><strong>${currentPhase.rir}</strong><small>${currentPhase.label}</small></article>
      <article class="metric"><span>Nutrition</span><strong>${nutritionTargets.kcal}</strong><small>kcal / jour</small></article>
    </div>

    ${section('Cadre')}
    <article class="plain-card phase-card">
      <span>Semaine ${state.currentWeek}/6</span>
      <strong>${currentPhase.label}</strong>
      <p>${currentPhase.note}</p>
      <div class="phase-line"><i style="width:${state.currentWeek / 6 * 100}%"></i></div>
    </article>
    ${coach('Consigne', 'Fais ce qui est prévu, note les données, puis récupère. Les ajustements viendront des tendances, pas d’une seule journée.')}
  `, 'home')

  document.querySelector('#start')?.addEventListener('click', () => go(`workout/${session.id}`))
  document.querySelector('#advance')?.addEventListener('click', () => {
    state.currentWeek += 1
    save()
    home()
  })
}

function program() {
  const currentPhase = phase()

  shell(`
    ${top('Programme', 'Recomposition · mésocycle 6 semaines')}
    <section class="program-intro">
      <div>
        <p class="kicker">PLAN</p>
        <h2>4 séances + 1 option</h2>
        <p>Deux stimulations hebdomadaires par grand groupe. Priorité dos, épaules et haut de pecs.</p>
      </div>
      <span>S${state.currentWeek}</span>
    </section>

    <div class="week-tabs">
      ${phases.map((item) => `<button data-week="${item.week}" class="${item.week === state.currentWeek ? 'active' : ''}">S${item.week}</button>`).join('')}
    </div>

    <article class="phase-summary">
      <strong>${currentPhase.label}</strong><span>RIR ${currentPhase.rir}</span><p>${currentPhase.note}</p>
    </article>

    ${section('Séances')}
    <div class="session-stack">
      ${sessions.map((session, index) => `
        <button class="session-card ${isDone(session.id) ? 'completed' : ''}" data-session="${session.id}">
          <div class="session-index">${session.optional ? 'OPT' : String(index + 1).padStart(2, '0')}</div>
          <div><h3>${session.name}</h3><p>${session.subtitle}</p><span>${session.duration} · ${session.exercises.length} exercices</span></div>
          <b>${isDone(session.id) ? 'Terminé' : 'Ouvrir'}</b>
        </button>`).join('')}
    </div>
    ${coach('Progression', 'Haut de fourchette atteint sur toutes les séries au RIR demandé : petite hausse de charge à la prochaine exposition.')}
  `, 'program')

  document.querySelectorAll('[data-session]').forEach((button) => {
    button.onclick = () => go(`workout/${button.dataset.session}`)
  })
  document.querySelectorAll('[data-week]').forEach((button) => {
    button.onclick = () => {
      state.currentWeek = Number(button.dataset.week)
      save()
      program()
    }
  })
}

function workout(id) {
  const session = sessions.find((item) => item.id === id) || sessions[0]
  const workout = workoutState(session.id)

  if (!workout.startedAt) {
    workout.startedAt = new Date().toISOString()
    save()
  }

  shell(`
    <header class="workout-head">
      <button class="icon-btn" id="back">‹</button>
      <div><p class="brandline">${session.name}</p><h1>${session.subtitle}</h1></div>
      <button class="timer-chip" id="timer">Repos</button>
    </header>

    <article class="workout-rule"><span>RIR ${phase().rir}</span><p>${phase().note}</p></article>

    <div class="exercise-stack">
      ${session.exercises.map((exercise, exerciseIndex) => `
        <article class="exercise-card">
          <div class="exercise-top">
            <div><span>Exercice ${exerciseIndex + 1}</span><h2>${exercise.name}</h2></div>
            <b>${exercise.sets} × ${exercise.reps}</b>
          </div>
          <div class="exercise-cues"><span>Réf. ${exercise.ref}</span><p>${exercise.cue}</p></div>
          <div class="sets-head"><span>Série</span><span>Charge</span><span>Reps</span><span>RIR</span></div>
          ${Array.from({ length: exercise.sets }, (_, setIndex) => {
            const row = workout.exercises?.[exerciseIndex]?.sets?.[setIndex] || {}
            return `<div class="set-row ${row.done ? 'done' : ''}">
              <button class="set-check" data-done="${exerciseIndex}:${setIndex}">${row.done ? '✓' : setIndex + 1}</button>
              ${['weight', 'reps', 'rir'].map((field) => `<label>
                <span>${field}</span>
                <input data-field="${field}" data-pos="${exerciseIndex}:${setIndex}" value="${esc(row[field] || '')}" inputmode="decimal" placeholder="—">
              </label>`).join('')}
            </div>`
          }).join('')}
          <button class="rest-btn" data-rest="${exercise.rest}">${Math.floor(exercise.rest / 60)}:${String(exercise.rest % 60).padStart(2, '0')} repos</button>
        </article>`).join('')}
    </div>

    <article class="plain-card cardio-card">
      <div><span>Cardio</span><strong>${session.cardio}</strong></div>
      <label class="switch"><input id="cardio" type="checkbox" ${workout.cardio ? 'checked' : ''}><i></i></label>
    </article>

    <article class="plain-card">
      <label class="textarea-label"><span>Note de séance</span><textarea id="notes" rows="3">${esc(workout.notes || '')}</textarea></label>
    </article>

    <button class="btn btn-primary btn-block" id="finish">Terminer la séance</button>
    <div class="timer-overlay hidden" id="rest-overlay">
      <div><span>Repos</span><strong id="tv">00:00</strong><div><button id="minus">−15 s</button><button id="close">Fermer</button><button id="plus">+15 s</button></div></div>
    </div>
  `, 'program')

  document.querySelector('#back').onclick = () => go('program')
  document.querySelectorAll('[data-field]').forEach((input) => {
    input.oninput = () => {
      const [exerciseIndex, setIndex] = input.dataset.pos.split(':').map(Number)
      workout.exercises[exerciseIndex] ||= { sets: [] }
      workout.exercises[exerciseIndex].sets[setIndex] ||= {}
      workout.exercises[exerciseIndex].sets[setIndex][input.dataset.field] = input.value
      save()
    }
  })
  document.querySelectorAll('[data-done]').forEach((button) => {
    button.onclick = () => {
      const [exerciseIndex, setIndex] = button.dataset.done.split(':').map(Number)
      workout.exercises[exerciseIndex] ||= { sets: [] }
      workout.exercises[exerciseIndex].sets[setIndex] ||= {}
      workout.exercises[exerciseIndex].sets[setIndex].done = !workout.exercises[exerciseIndex].sets[setIndex].done
      save()
      workoutView(id)
    }
  })
  document.querySelectorAll('[data-rest]').forEach((button) => {
    button.onclick = () => startTimer(Number(button.dataset.rest))
  })
  document.querySelector('#timer').onclick = () => startTimer(90)
  document.querySelector('#cardio').onchange = (event) => {
    workout.cardio = event.target.checked
    save()
  }
  document.querySelector('#notes').oninput = (event) => {
    workout.notes = event.target.value
    save()
  }
  document.querySelector('#finish').onclick = () => {
    workout.completed = true
    workout.completedAt = new Date().toISOString()
    state.history.push({
      id: `${id}-${Date.now()}`,
      sessionId: id,
      name: session.name,
      date: TODAY(),
      week: state.currentWeek,
      exercises: clone(workout.exercises),
      cardio: workout.cardio,
      notes: workout.notes
    })
    save()
    go('checkin')
  }
}

// Alias explicite : évite de confondre l'objet `workout` avec la vue lors des rerenders.
const workoutView = workout

function startTimer(seconds) {
  timerRemaining = seconds
  document.querySelector('#rest-overlay')?.classList.remove('hidden')
  drawTimer()
  clearInterval(timerHandle)
  timerHandle = setInterval(() => {
    timerRemaining = Math.max(0, timerRemaining - 1)
    drawTimer()
    if (!timerRemaining) {
      clearInterval(timerHandle)
      navigator.vibrate?.(150)
    }
  }, 1000)

  document.querySelector('#close').onclick = () => document.querySelector('#rest-overlay')?.classList.add('hidden')
  document.querySelector('#minus').onclick = () => {
    timerRemaining = Math.max(0, timerRemaining - 15)
    drawTimer()
  }
  document.querySelector('#plus').onclick = () => {
    timerRemaining += 15
    drawTimer()
  }
}

function drawTimer() {
  const node = document.querySelector('#tv')
  if (node) node.textContent = `${String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:${String(timerRemaining % 60).padStart(2, '0')}`
}

function nutritionPage() {
  const day = nutritionDay(TODAY())

  shell(`
    ${top('Nutrition', 'Plan alimentaire adapté au travail de nuit')}
    <section class="nutrition-hero">
      <div><p class="kicker">CIBLE QUOTIDIENNE</p><h2>${nutritionTargets.kcal}</h2><span>kcal</span></div>
      <div><strong>${nutritionTargets.protein} g</strong><span>protéines</span></div>
    </section>

    <div class="macro-grid">
      <article><span>Protéines</span><strong>${nutritionTargets.protein} g</strong></article>
      <article><span>Lipides</span><strong>${nutritionTargets.fat} g</strong></article>
      <article><span>Glucides</span><strong>≈ ${nutritionTargets.carbs} g</strong></article>
      <article><span>Créatine</span><strong>${nutritionTargets.creatine}</strong></article>
    </div>

    <div id="nutrition-tools-slot"></div>

    ${section('Plan de la journée')}
    <p class="nutrition-note">Poids indiqués cuits quand c’est précisé. Choisis une seule variante par repas. Les marques changent les calories : vérifie les étiquettes et ajuste légèrement les féculents si nécessaire.</p>
    <div class="meal-plan">
      ${mealPlan.map((meal) => `<article class="meal-card">
        <header><div><span>${meal.time}</span><h3>${meal.title}</h3></div><small>${meal.target}</small></header>
        <div class="meal-options">${meal.options.map((option, index) => `<div><b>Option ${index + 1} · ${option.name}</b>${option.items.map((item) => `<p>${item}</p>`).join('')}</div>`).join('')}</div>
      </article>`).join('')}
    </div>

    ${coach('Hydratation', 'Garde de l’eau disponible pendant tout le poste. Créatine 3–5 g chaque jour. Caféine plutôt en début de poste afin de protéger le sommeil.')}

    ${section('Bilan du jour')}
    <article class="plain-card food-log">
      ${day.scanned.count ? `<p class="nutrition-note">Prérempli à partir de ${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''} enregistré${day.scanned.count > 1 ? 's' : ''}. Tu peux corriger avant de valider.</p>` : ''}
      <div class="form-grid">
        <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
        <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
        <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
        <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveNut">Enregistrer</button>
    </article>
  `, 'nutrition')

  document.querySelector('#saveNut').onclick = () => {
    state.nutritionDays[TODAY()] = {
      kcal: document.querySelector('#kcal').value,
      protein: document.querySelector('#protein').value,
      fat: document.querySelector('#fat').value,
      carbs: document.querySelector('#carbs').value
    }
    save()
    nutritionPage()
  }
}

function progress() {
  const body = state.body.at(-1) || J0

  shell(`
    ${top('Progrès', 'Poids, tour de nombril et performances')}
    <div class="metric-grid">
      <article class="metric"><span>Poids actuel</span><strong>${num(body.weight)} kg</strong><small>J0 75 kg</small></article>
      <article class="metric"><span>Nombril actuel</span><strong>${num(body.navel)} cm</strong><small>J0 96 cm</small></article>
    </div>

    ${section('Nouveau relevé')}
    <article class="plain-card food-log">
      <div class="form-grid">
        <label>Poids<input id="weight" inputmode="decimal"></label>
        <label>Nombril<input id="navel" inputmode="decimal"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveBody">Enregistrer</button>
    </article>

    ${section('Point zéro')}
    <div class="macro-grid">
      ${[['Poitrine', 101], ['Taille', 88], ['Hanches', 102.5], ['Bras', 31], ['Cuisses', 52], ['Mollets', 33.5]].map(([label, value]) => `<article><span>${label}</span><strong>${value} cm</strong></article>`).join('')}
    </div>
    ${coach('Lecture du progrès', 'On cherche une baisse graduelle du tour de nombril avec des performances qui remontent. Le poids seul ne décide pas.')}
  `, 'progress')

  document.querySelector('#saveBody').onclick = () => {
    const weight = parseFloat(document.querySelector('#weight').value.replace(',', '.'))
    const navel = parseFloat(document.querySelector('#navel').value.replace(',', '.'))
    if (!weight && !navel) return
    state.body.push({ date: TODAY(), weight: weight || body.weight, navel: navel || body.navel })
    save()
    progress()
  }
}

function checkin() {
  const nutrition = nutritionDay(TODAY())

  shell(`
    ${top('Check-in', '30 secondes après la journée ou la séance')}
    <form class="check-form" id="cf">
      <label>Sommeil (h)<input name="sleep" inputmode="decimal" required></label>
      <label>Sensations /10<input name="feeling" inputmode="numeric" required></label>
      <label>Calories<input name="kcal" value="${esc(nutrition.kcal)}"></label>
      <label>Protéines (g)<input name="protein" value="${esc(nutrition.protein)}"></label>
      <label>Douleur ou gêne<textarea name="pain" rows="3" placeholder="Aucune, ou précise la zone"></textarea></label>
      <button class="btn btn-primary btn-block">Enregistrer le check-in</button>
    </form>

    ${section('Rapport coach')}
    <article class="plain-card">
      <p class="nutrition-note">Copie ce rapport dans notre conversation pour que j’ajuste le programme à partir de données réelles.</p>
      <button class="btn btn-secondary btn-block" id="report">Copier le rapport</button>
    </article>
  `, 'checkin')

  document.querySelector('#cf').onsubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.target)
    state.checkins.push({
      date: TODAY(),
      sleep: form.get('sleep'),
      feeling: form.get('feeling'),
      kcal: form.get('kcal'),
      protein: form.get('protein'),
      pain: form.get('pain')
    })
    save()
    home()
  }

  document.querySelector('#report').onclick = async () => {
    const body = state.body.at(-1)
    const last = state.checkins.at(-1)
    const text = `APEX — Rapport coach\nSemaine ${state.currentWeek}/6 (${phase().label})\nSéances semaine: ${mandatoryDone()}/4\nPoids: ${body?.weight ?? '—'} kg | Nombril: ${body?.navel ?? '—'} cm\nSommeil: ${last?.sleep ?? '—'} h | Sensations: ${last?.feeling ?? '—'}/10\nCalories: ${last?.kcal ?? '—'} | Protéines: ${last?.protein ?? '—'} g\nDouleur/gêne: ${last?.pain || 'Aucune'}\nHistorique total: ${state.history.length} séances`
    try {
      await navigator.clipboard.writeText(text)
      document.querySelector('#report').textContent = 'Rapport copié'
    } catch {
      prompt('Copie le rapport :', text)
    }
  }
}

function go(route) {
  location.hash = route
}

function render() {
  const route = (location.hash || '#home').slice(1)
  if (route.startsWith('workout/')) workout(route.split('/')[1])
  else ({ home, program, nutrition: nutritionPage, progress, checkin }[route] || home)()
}

window.addEventListener('hashchange', render)
window.addEventListener('apex:state-changed', (event) => {
  if (event.detail?.scope === 'nutrition' && (location.hash || '#home') === '#nutrition') nutritionPage()
})

render()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
