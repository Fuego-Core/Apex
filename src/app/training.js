import { J0, nutritionTargets, phases, sessions } from './config.js'
import { TODAY, clone, nutritionDay, save, state } from './store.js'
import { coach, esc, go, num, section, shell, top } from './ui.js'

let timerHandle = null
let timerRemaining = 0

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

function currentBody() {
  return [...(state.body || [])]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .reduce((body, row) => ({ ...body, ...row }), { ...J0 })
}

export function phase() {
  return phases[state.currentWeek - 1] || phases[0]
}

export function mandatoryDone() {
  return sessions.filter((session) => !session.optional && isDone(session.id)).length
}

function nextSession() {
  return sessions.filter((session) => !session.optional).find((session) => !isDone(session.id)) || sessions[0]
}

export function home() {
  const session = nextSession()
  const currentPhase = phase()
  const completed = mandatoryDone()
  const finished = completed === 4
  const body = currentBody()
  const today = TODAY()
  const nutrition = nutritionDay(today)
  const nutritionTracked = nutrition.source !== 'empty'
  const nutritionKcal = Number(nutrition.kcal) || 0
  const checkedIn = state.checkins.some((item) => item.date === today)
  const measured = state.body.some((item) => item.date === today)

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
      <article class="metric"><span>Poids</span><strong>${num(body.weight)} kg</strong><small>J0 ${J0.weight} kg</small></article>
      <article class="metric"><span>Nombril</span><strong>${num(body.navel)} cm</strong><small>J0 ${J0.navel} cm</small></article>
      <article class="metric"><span>RIR cible</span><strong>${currentPhase.rir}</strong><small>${currentPhase.label}</small></article>
      <article class="metric"><span>Nutrition</span><strong>${nutritionTracked ? Math.round(nutritionKcal) : nutritionTargets.kcal}</strong><small>${nutritionTracked ? `sur ${nutritionTargets.kcal} kcal` : 'cible kcal / jour'}</small></article>
    </div>

    ${section('À faire aujourd’hui')}
    <div class="daily-grid">
      <button class="daily-action ${nutritionTracked ? 'done' : ''}" data-daily="nutrition"><span>Nutrition</span><strong>${nutritionTracked ? `${Math.round(nutritionKcal)} kcal` : 'À enregistrer'}</strong><small>${nutritionTracked ? `${Math.round(Number(nutrition.protein) || 0)} g protéines` : 'Scanner ou saisir les repas'}</small></button>
      <button class="daily-action ${checkedIn ? 'done' : ''}" data-daily="checkin"><span>Check-in</span><strong>${checkedIn ? 'Fait' : 'À faire'}</strong><small>Sommeil · sensations · douleurs</small></button>
      <button class="daily-action ${measured ? 'done' : ''}" data-daily="progress"><span>Mesures</span><strong>${measured ? 'Relevé du jour' : 'Quand prévu'}</strong><small>Poids · nombril · mensurations</small></button>
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
  document.querySelectorAll('[data-daily]').forEach((button) => {
    button.onclick = () => go(button.dataset.daily)
  })
}

export function program() {
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

export function workoutView(id) {
  const session = sessions.find((item) => item.id === id) || sessions[0]
  const currentWorkout = workoutState(session.id)

  if (!currentWorkout.startedAt) {
    currentWorkout.startedAt = new Date().toISOString()
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
            const row = currentWorkout.exercises?.[exerciseIndex]?.sets?.[setIndex] || {}
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
      <label class="switch"><input id="cardio" type="checkbox" ${currentWorkout.cardio ? 'checked' : ''}><i></i></label>
    </article>

    <article class="plain-card">
      <label class="textarea-label"><span>Note de séance</span><textarea id="notes" rows="3">${esc(currentWorkout.notes || '')}</textarea></label>
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
      currentWorkout.exercises[exerciseIndex] ||= { sets: [] }
      currentWorkout.exercises[exerciseIndex].sets[setIndex] ||= {}
      currentWorkout.exercises[exerciseIndex].sets[setIndex][input.dataset.field] = input.value
      save()
    }
  })
  document.querySelectorAll('[data-done]').forEach((button) => {
    button.onclick = () => {
      const [exerciseIndex, setIndex] = button.dataset.done.split(':').map(Number)
      currentWorkout.exercises[exerciseIndex] ||= { sets: [] }
      currentWorkout.exercises[exerciseIndex].sets[setIndex] ||= {}
      currentWorkout.exercises[exerciseIndex].sets[setIndex].done = !currentWorkout.exercises[exerciseIndex].sets[setIndex].done
      save()
      workoutView(id)
    }
  })
  document.querySelectorAll('[data-rest]').forEach((button) => {
    button.onclick = () => startTimer(Number(button.dataset.rest))
  })
  document.querySelector('#timer').onclick = () => startTimer(90)
  document.querySelector('#cardio').onchange = (event) => {
    currentWorkout.cardio = event.target.checked
    save()
  }
  document.querySelector('#notes').oninput = (event) => {
    currentWorkout.notes = event.target.value
    save()
  }
  document.querySelector('#finish').onclick = () => {
    currentWorkout.completed = true
    currentWorkout.completedAt = new Date().toISOString()
    state.history.push({
      id: `${id}-${Date.now()}`,
      sessionId: id,
      name: session.name,
      date: TODAY(),
      week: state.currentWeek,
      exercises: clone(currentWorkout.exercises),
      cardio: currentWorkout.cardio,
      notes: currentWorkout.notes
    })
    save()
    go('checkin')
  }
}

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
