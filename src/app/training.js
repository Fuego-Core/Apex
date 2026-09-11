import { J0, nutritionTargets, phases, sessions } from './config.js'
import { recoveryAssessment } from './coach-engine.js'
import { TODAY, clone, nutritionDay, save, state } from './store.js'
import { coach, esc, go, num, section, shell, top } from './ui.js'

let timerHandle = null
let timerRemaining = 0

function number(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
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

function previousSession(sessionId, excludeHistoryId = null) {
  return [...(state.history || [])]
    .filter((entry) => entry.sessionId === sessionId && entry.id !== excludeHistoryId)
    .sort((a, b) => String(b.updatedAt || b.date || '').localeCompare(String(a.updatedAt || a.date || '')))[0] || null
}

function isAssistanceExercise(exercise) {
  return /assist/i.test(exercise.name)
}

function roundGymLoad(value) {
  return Math.round(value * 2) / 2
}

function deloadLoad(value, exercise) {
  const load = number(value)
  if (load === null || load <= 0) return value
  return roundGymLoad(load * (isAssistanceExercise(exercise) ? 1.1 : 0.9))
}

function effectiveSets(exercise) {
  if (state.currentWeek !== 6) return exercise.sets
  return Math.max(1, Math.ceil(exercise.sets * 0.5))
}

function hydrateFromPrevious(session, currentWorkout) {
  if (currentWorkout.completed) return
  const previous = previousSession(session.id, currentWorkout.historyId)
  if (!previous || currentWorkout.prefilledFromHistoryId === previous.id) return

  session.exercises.forEach((exercise, exerciseIndex) => {
    const previousSets = previous.exercises?.[exerciseIndex]?.sets || []
    const plannedSets = effectiveSets(exercise)
    if (!previousSets.length) return
    currentWorkout.exercises[exerciseIndex] ||= { sets: [] }
    for (let setIndex = 0; setIndex < plannedSets; setIndex += 1) {
      const prior = previousSets[setIndex] || previousSets.at(-1)
      if (!prior) continue
      currentWorkout.exercises[exerciseIndex].sets[setIndex] ||= {}
      const row = currentWorkout.exercises[exerciseIndex].sets[setIndex]
      if ((row.weight === undefined || row.weight === '') && prior.weight !== undefined && prior.weight !== '') {
        row.weight = state.currentWeek === 6 ? deloadLoad(prior.weight, exercise) : prior.weight
      }
      if ((row.reps === undefined || row.reps === '') && prior.reps !== undefined && prior.reps !== '') row.reps = prior.reps
    }
  })
  currentWorkout.prefilledFromHistoryId = previous.id
  save()
}

function performanceBlock(session, exercise, exerciseIndex, currentWorkout) {
  const previous = previousSession(session.id, currentWorkout.historyId)
  const sets = previous?.exercises?.[exerciseIndex]?.sets || []
  const completed = sets.filter((row) => row && (row.done || row.weight || row.reps))
  if (!completed.length) {
    return `<div class="previous-performance"><span>PREMIÈRE RÉFÉRENCE</span><strong>${esc(exercise.ref)}</strong><small>Choisis une charge qui respecte le RIR demandé et crée une base propre pour la prochaine exposition.</small></div>`
  }

  const reps = completed.map((row) => row.reps).filter((value) => value !== undefined && value !== '').join(' · ')
  const weights = completed.map((row) => row.weight).filter((value) => value !== undefined && value !== '')
  const weight = weights[0] ?? '—'
  let target

  if (state.currentWeek === 6) {
    target = isAssistanceExercise(exercise)
      ? 'Deload : environ moitié moins de séries et un peu plus d’assistance. Aucune série forcée.'
      : 'Deload : environ moitié moins de séries et ~10 % de charge en moins. Garde au moins 4 RIR.'
  } else if (isAssistanceExercise(exercise)) {
    target = 'Vise 1 rep propre de plus à assistance identique. Haut de fourchette atteint partout : réduis légèrement l’assistance la prochaine fois.'
  } else {
    target = 'Vise 1 rep propre de plus à charge identique. Haut de fourchette atteint partout au RIR cible : augmente légèrement la charge.'
  }

  return `<div class="previous-performance">
    <span>DERNIÈRE FOIS</span>
    <strong>${esc(weight)}${number(weight) !== null ? ' kg' : ''}${reps ? ` · ${esc(reps)} reps` : ''}</strong>
    <small>${esc(target)}</small>
  </div>`
}

function plannedSetCount(session) {
  return session.exercises.reduce((sum, exercise) => sum + effectiveSets(exercise), 0)
}

function completedSetCount(currentWorkout, session) {
  return session.exercises.reduce((sum, exercise, exerciseIndex) => {
    const sets = currentWorkout.exercises?.[exerciseIndex]?.sets || []
    return sum + sets.slice(0, effectiveSets(exercise)).filter((row) => row?.done).length
  }, 0)
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
  const decision = recoveryAssessment()
  const coachMeta = [
    decision.sleep !== null ? `${decision.sleep.toFixed(1).replace('.', ',')} h sommeil moy.` : null,
    decision.feeling !== null ? `${decision.feeling.toFixed(1).replace('.', ',')}/10 sensations` : null
  ].filter(Boolean).join(' · ')

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

    <section class="smart-coach smart-coach--${decision.level}">
      <div class="smart-coach__head"><span>COACH APEX</span><strong>${esc(decision.title)}</strong></div>
      <p>${esc(decision.message)}</p>
      <small>${coachMeta ? esc(coachMeta) : 'Complète ton check-in pour affiner la recommandation.'}</small>
      ${decision.notes.length ? `<div class="smart-coach__notes">${decision.notes.map((note) => `<span>${esc(note)}</span>`).join('')}</div>` : ''}
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
    ${coach('Consigne', state.currentWeek === 6 ? 'Deload réel : volume réduit d’environ moitié et charges allégées. Le but est de sortir frais, pas de prouver ta force.' : 'Fais ce qui est prévu, note les données, puis récupère. Les ajustements viennent des tendances, pas d’une seule journée.')}
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
      ${state.currentWeek === 6 ? '<p><strong>Deload actif :</strong> environ 50 % de séries en moins et charges réduites automatiquement au départ.</p>' : ''}
    </article>

    ${section('Séances')}
    <div class="session-stack">
      ${sessions.map((session, index) => `
        <button class="session-card ${isDone(session.id) ? 'completed' : ''}" data-session="${session.id}">
          <div class="session-index">${session.optional ? 'OPT' : String(index + 1).padStart(2, '0')}</div>
          <div><h3>${session.name}</h3><p>${session.subtitle}</p><span>${session.duration} · ${state.currentWeek === 6 ? 'volume deload' : `${session.exercises.length} exercices`}</span></div>
          <b>${isDone(session.id) ? 'Terminé' : 'Ouvrir'}</b>
        </button>`).join('')}
    </div>
    ${coach('Progression', state.currentWeek === 6 ? 'Cette semaine n’est pas faite pour progresser : récupère, garde la technique et prépare le prochain cycle.' : 'Haut de fourchette atteint sur toutes les séries au RIR demandé : petite hausse de charge à la prochaine exposition.')}
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

  hydrateFromPrevious(session, currentWorkout)

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

    <article class="workout-rule"><span>RIR ${phase().rir}</span><p>${state.currentWeek === 6 ? 'Deload : volume réduit et charges allégées.' : phase().note}</p></article>

    <div class="exercise-stack">
      ${session.exercises.map((exercise, exerciseIndex) => {
        const setsCount = effectiveSets(exercise)
        return `<article class="exercise-card">
          <div class="exercise-top">
            <div><span>Exercice ${exerciseIndex + 1}</span><h2>${exercise.name}</h2></div>
            <b>${setsCount} × ${exercise.reps}${state.currentWeek === 6 ? ' · DELOAD' : ''}</b>
          </div>
          <div class="exercise-cues"><span>Réf. ${exercise.ref}</span><p>${exercise.cue}</p></div>
          ${performanceBlock(session, exercise, exerciseIndex, currentWorkout)}
          <div class="sets-head"><span>Série</span><span>Charge</span><span>Reps</span><span>RIR</span></div>
          ${Array.from({ length: setsCount }, (_, setIndex) => {
            const row = currentWorkout.exercises?.[exerciseIndex]?.sets?.[setIndex] || {}
            return `<div class="set-row ${row.done ? 'done' : ''}">
              <button class="set-check" data-done="${exerciseIndex}:${setIndex}">${row.done ? '✓' : setIndex + 1}</button>
              ${['weight', 'reps', 'rir'].map((field) => `<label>
                <span>${field}</span>
                <input data-field="${field}" data-pos="${exerciseIndex}:${setIndex}" value="${esc(row[field] ?? '')}" inputmode="decimal" placeholder="—">
              </label>`).join('')}
            </div>`
          }).join('')}
          <button class="rest-btn" data-rest="${exercise.rest}">${Math.floor(exercise.rest / 60)}:${String(exercise.rest % 60).padStart(2, '0')} repos</button>
        </article>`
      }).join('')}
    </div>

    <article class="plain-card cardio-card">
      <div><span>Cardio</span><strong>${session.cardio}</strong></div>
      <label class="switch"><input id="cardio" type="checkbox" ${currentWorkout.cardio ? 'checked' : ''}><i></i></label>
    </article>

    <article class="plain-card">
      <label class="textarea-label"><span>Note de séance</span><textarea id="notes" rows="3">${esc(currentWorkout.notes || '')}</textarea></label>
    </article>

    <button class="btn btn-primary btn-block" id="finish">${currentWorkout.completed ? 'Mettre à jour la séance' : 'Terminer la séance'}</button>
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
    const planned = plannedSetCount(session)
    const completedSets = completedSetCount(currentWorkout, session)
    if (completedSets < planned && !confirm(`Il reste ${planned - completedSets} série${planned - completedSets > 1 ? 's' : ''} non validée${planned - completedSets > 1 ? 's' : ''}. Terminer quand même la séance ?`)) return

    const now = new Date().toISOString()
    const historyEntry = {
      sessionId: id,
      name: session.name,
      date: TODAY(),
      week: state.currentWeek,
      phase: phase().label,
      plannedSets: planned,
      completedSets,
      exercises: clone(currentWorkout.exercises),
      cardio: currentWorkout.cardio,
      notes: currentWorkout.notes,
      updatedAt: now
    }
    let historyIndex = currentWorkout.historyId
      ? state.history.findIndex((entry) => entry.id === currentWorkout.historyId)
      : -1
    if (historyIndex < 0 && currentWorkout.completed) {
      historyIndex = state.history.findIndex((entry) => entry.sessionId === id && Number(entry.week) === Number(state.currentWeek))
    }

    if (historyIndex >= 0) {
      state.history[historyIndex] = { ...state.history[historyIndex], ...historyEntry }
      currentWorkout.historyId = state.history[historyIndex].id
    } else {
      const historyId = `${id}-${Date.now()}`
      state.history.push({ id: historyId, ...historyEntry })
      currentWorkout.historyId = historyId
    }

    currentWorkout.completed = true
    currentWorkout.completedAt ||= now
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
