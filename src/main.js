import './styles.css'

const STORAGE = 'apex-coach-pro-v1'
const TODAY = () => new Date().toISOString().slice(0, 10)
const J0 = {
  date: '2026-09-11',
  weight: 75,
  height: 172,
  neck: 42,
  chest: 101,
  waist: 88,
  navel: 96,
  hips: 102.5,
  armL: 31,
  armR: 31,
  thighL: 52,
  thighR: 52,
  calfL: 33.5,
  calfR: 33.5,
}

const nutrition = {
  kcal: 2300,
  protein: 155,
  fat: 70,
  carbs: 250,
  creatine: '3–5 g',
}

const phases = [
  { week: 1, label: 'Reprise', rir: '3', note: 'Technique propre, aucune série forcée.' },
  { week: 2, label: 'Construction', rir: '2–3', note: 'On remonte doucement les charges.' },
  { week: 3, label: 'Progression', rir: '2', note: 'Double progression sur les mouvements principaux.' },
  { week: 4, label: 'Progression', rir: '2', note: 'Stabiliser la forme et battre les reps propres.' },
  { week: 5, label: 'Semaine forte', rir: '1–2', note: 'Effort élevé, toujours sans sacrifier la technique.' },
  { week: 6, label: 'Deload', rir: '4', note: 'Volume réduit et récupération prioritaire.' },
]

const sessions = [
  {
    id: 'upper-a',
    name: 'Upper A',
    subtitle: 'Pecs · Dos · Largeur',
    duration: '70–80 min',
    cardio: '15 min de marche inclinée facile',
    exercises: [
      { name: 'Chest press machine', sets: 3, reps: '6–8', rest: 120, ref: '50 kg', cue: 'Omoplates fixées, amplitude contrôlée.' },
      { name: 'Tractions assistées', sets: 3, reps: '6–10', rest: 120, ref: 'Noter l’assistance', cue: 'Poitrine haute, aucun élan.' },
      { name: 'Développé incliné haltères', sets: 3, reps: '8–10', rest: 105, ref: '16 kg', cue: 'Banc 30–45°, trajectoire stable.' },
      { name: 'Rowing poulie assis', sets: 3, reps: '8–12', rest: 105, ref: '37 kg', cue: 'Tirer par les coudes, torse fixe.' },
      { name: 'Élévations latérales', sets: 3, reps: '12–15', rest: 75, ref: '8 kg', cue: 'Épaules basses, pas d’élan.' },
      { name: 'Dips assistés', sets: 2, reps: '8–12', rest: 105, ref: '25 kg assistance', cue: 'Amplitude confortable, épaules stables.' },
      { name: 'Curl incliné', sets: 2, reps: '10–12', rest: 75, ref: '6 kg', cue: 'Étirement complet, coude fixe.' },
    ],
  },
  {
    id: 'lower-a',
    name: 'Lower A',
    subtitle: 'Quadriceps · Ischios · Mollets',
    duration: '65–75 min',
    cardio: '10 min facile si les jambes récupèrent bien',
    exercises: [
      { name: 'Hack squat', sets: 3, reps: '8–10', rest: 150, ref: '27 kg', cue: 'Profondeur stable, genoux dans l’axe.' },
      { name: 'Presse à jambes', sets: 3, reps: '10–12', rest: 120, ref: '54 kg', cue: 'Ne pas décoller le bassin.' },
      { name: 'Leg curl', sets: 3, reps: '10–12', rest: 90, ref: '20 kg', cue: 'Contraction nette, retour lent.' },
      { name: 'Fentes marchées', sets: 2, reps: '10 / jambe', rest: 90, ref: '8 kg', cue: 'Pas réguliers, bassin stable.' },
      { name: 'Mollets', sets: 3, reps: '10–15', rest: 75, ref: '10 kg', cue: 'Pause en bas et en haut.' },
      { name: 'Crunch poulie', sets: 3, reps: '10–15', rest: 60, ref: 'À calibrer', cue: 'Enrouler le tronc, pas les hanches.' },
    ],
  },
  {
    id: 'upper-b',
    name: 'Upper B',
    subtitle: 'Dos · Épaules · Haut de pecs',
    duration: '70–80 min',
    cardio: '15 min de marche inclinée facile',
    exercises: [
      { name: 'Développé incliné', sets: 3, reps: '8–10', rest: 105, ref: 'Charge de reprise', cue: 'Haut de pecs, contrôle complet.' },
      { name: 'Tirage vertical', sets: 3, reps: '8–10', rest: 105, ref: '39 kg', cue: 'Coudes vers le sol, poitrine haute.' },
      { name: 'Shoulder press machine', sets: 3, reps: '8–10', rest: 105, ref: '19 kg', cue: 'Pas de rebond en bas.' },
      { name: 'Rowing prise serrée', sets: 3, reps: '8–12', rest: 105, ref: '37 kg', cue: 'Omoplates contrôlées.' },
      { name: 'Élévations latérales', sets: 3, reps: '12–15', rest: 75, ref: '8 kg', cue: 'Priorité au deltoïde latéral.' },
      { name: 'Reverse fly', sets: 2, reps: '12–15', rest: 75, ref: '11–25 kg machine', cue: 'Arrière d’épaule, mouvement court et propre.' },
      { name: 'Extension triceps', sets: 2, reps: '10–12', rest: 75, ref: '11 kg', cue: 'Coudes fixes.' },
      { name: 'Curl marteau', sets: 2, reps: '10–12', rest: 75, ref: '6 kg', cue: 'Poignets neutres, pas d’élan.' },
    ],
  },
  {
    id: 'lower-b',
    name: 'Lower B',
    subtitle: 'Chaîne postérieure · Unilatéral',
    duration: '65–75 min',
    cardio: '10 min facile ou rien si fatigue jambes',
    exercises: [
      { name: 'Soulevé de terre roumain', sets: 3, reps: '8–10', rest: 150, ref: '40 kg', cue: 'Hanches en arrière, dos neutre.' },
      { name: 'Fente bulgare', sets: 3, reps: '8–10 / jambe', rest: 105, ref: '8 kg', cue: 'Stabilité avant charge.' },
      { name: 'Leg curl', sets: 3, reps: '10–12', rest: 90, ref: '20 kg', cue: 'Tempo propre.' },
      { name: 'Hip thrust', sets: 3, reps: '8–12', rest: 105, ref: '20 kg', cue: 'Verrouiller les fessiers sans hyperextension.' },
      { name: 'Leg extension', sets: 2, reps: '12–15', rest: 75, ref: '20 kg', cue: 'Contrôle sur toute l’amplitude.' },
      { name: 'Mollets', sets: 3, reps: '12–15', rest: 75, ref: '9–10 kg', cue: 'Amplitude complète.' },
      { name: 'Abdos', sets: 3, reps: '10–15', rest: 60, ref: 'À calibrer', cue: 'Choisir une variante stable et mesurable.' },
    ],
  },
  {
    id: 'skills',
    name: 'Skills',
    subtitle: 'Calisthénie technique',
    duration: '25–35 min',
    optional: true,
    cardio: 'Aucun cardio obligatoire',
    exercises: [
      { name: 'Suspension barre', sets: 3, reps: '20–40 sec', rest: 60, ref: 'Poids du corps', cue: 'Prise active et confortable.' },
      { name: 'Scapular pull-ups', sets: 3, reps: '6–10', rest: 60, ref: 'Poids du corps', cue: 'Petite amplitude, épaules contrôlées.' },
      { name: 'Pompes strictes', sets: 3, reps: '8–15', rest: 75, ref: 'Poids du corps', cue: 'Toujours garder de la marge.' },
      { name: 'Support dips', sets: 3, reps: '15–30 sec', rest: 60, ref: 'Poids du corps', cue: 'Bras tendus, épaules basses.' },
      { name: 'Handstand au mur', sets: 4, reps: '20–30 sec', rest: 60, ref: 'Technique', cue: 'Pas à l’échec.' },
    ],
  },
]

const DEFAULT_STATE = {
  createdAt: TODAY(),
  currentWeek: 1,
  body: [{ date: J0.date, weight: J0.weight, navel: J0.navel }],
  sessions: {},
  history: [],
  checkins: [],
  nutritionDays: {},
}

let state = load()
let timerHandle = null
let timerRemaining = 0

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || 'null')
    return parsed ? { ...clone(DEFAULT_STATE), ...parsed } : clone(DEFAULT_STATE)
  } catch {
    return clone(DEFAULT_STATE)
  }
}
function save() { localStorage.setItem(STORAGE, JSON.stringify(state)) }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}
function number(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: digits })
}
function dateFr(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function mandatoryDone() {
  return sessions.filter((s) => !s.optional && state.sessions[s.id]?.completed).length
}
function weekPhase() { return phases.find((p) => p.week === state.currentWeek) || phases[0] }
function nextSession() {
  const mandatory = sessions.filter((s) => !s.optional)
  return mandatory.find((s) => !state.sessions[s.id]?.completed) || mandatory[0]
}
function latestBody() { return state.body[state.body.length - 1] || J0 }
function latestCheckin() { return state.checkins[state.checkins.length - 1] }
function workoutState(id) {
  state.sessions[id] ||= { exercises: {}, completed: false, startedAt: null, cardio: false, notes: '' }
  return state.sessions[id]
}
function setLog(id, exIndex, setIndex, key, value) {
  const ws = workoutState(id)
  ws.exercises[exIndex] ||= { sets: [] }
  ws.exercises[exIndex].sets[setIndex] ||= { weight: '', reps: '', rir: '', done: false }
  ws.exercises[exIndex].sets[setIndex][key] = value
  save()
}

function icon(name) {
  const icons = {
    home: '<path d="M3 11.5 12 4l9 7.5v8.2a1.3 1.3 0 0 1-1.3 1.3h-5.2v-6h-5v6H4.3A1.3 1.3 0 0 1 3 19.7z"/>',
    program: '<path d="M4 5.5h16M4 12h16M4 18.5h16"/><circle cx="7" cy="5.5" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="10" cy="18.5" r="1.4"/>',
    nutrition: '<path d="M12 3v18M5 7h14M7 7v4a5 5 0 0 0 10 0V7"/>',
    progress: '<path d="M4 17 9 12l3 3 7-8"/><path d="M15 7h4v4"/>',
    checkin: '<path d="m5 12 4 4L19 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    chart: '<path d="M4 19V5M4 19h16M7 16l4-5 3 2 5-7"/>',
    copy: '<rect x="8" y="8" width="10" height="11" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.home}</svg>`
}

function bottomNav(active) {
  const items = [
    ['home', 'home', 'Aujourd’hui'],
    ['program', 'program', 'Programme'],
    ['nutrition', 'nutrition', 'Nutrition'],
    ['progress', 'progress', 'Progrès'],
    ['checkin', 'checkin', 'Check-in'],
  ]
  return `<nav class="bottom-nav">${items.map(([route, ic, label]) => `<button data-nav="${route}" class="nav-item ${active === route ? 'active' : ''}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`
}

function shell(content, active = 'home', title = 'APEX') {
  document.querySelector('#app').innerHTML = `<div class="app-shell"><main class="content" aria-label="${escapeHtml(title)}">${content}</main>${bottomNav(active)}</div>`
  document.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => go(el.dataset.nav)))
}

function top(title, subtitle = '') {
  return `<header class="page-head"><div><p class="brandline">APEX</p><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><div class="profile-dot">F</div></header>`
}
function sectionTitle(title, action = '') {
  return `<div class="section-head"><h2>${escapeHtml(title)}</h2>${action}</div>`
}
function ring(value, label) {
  return `<div class="progress-ring" style="--value:${Math.max(0, Math.min(100, value))}"><div><strong>${value}%</strong><span>${escapeHtml(label)}</span></div></div>`
}
function coachCard(title, text) {
  return `<article class="coach-card"><div class="coach-mark">C</div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div></article>`
}
function getRoute() { return location.hash.replace(/^#\/?/, '') || 'home' }
function go(route) { location.hash = `#/${route}` }

function homePage() {
  const session = nextSession()
  const phase = weekPhase()
  const body = latestBody()
  const done = mandatoryDone()
  const pct = Math.round((done / 4) * 100)
  const last = latestCheckin()
  shell(`
    ${top('Aujourd’hui', `Semaine ${state.currentWeek} · ${phase.label}`)}
    <section class="today-card">
      <div class="today-main">
        <p class="kicker">PROCHAINE SÉANCE</p>
        <h2>${session.name}</h2>
        <p class="muted">${session.subtitle}</p>
        <div class="meta-row"><span>${icon('clock')} ${session.duration}</span><span>${session.exercises.length} exercices</span></div>
        <button class="btn btn-primary" id="startWorkout">Commencer</button>
      </div>
      ${ring(pct, 'semaine')}
    </section>

    <div class="metric-grid">
      <article class="metric"><span>Poids</span><strong>${number(body.weight)} kg</strong><small>J0 : 75,0 kg</small></article>
      <article class="metric"><span>Nombril</span><strong>${number(body.navel)} cm</strong><small>J0 : 96,0 cm</small></article>
      <article class="metric"><span>RIR cible</span><strong>${phase.rir}</strong><small>${phase.label}</small></article>
      <article class="metric"><span>Sommeil</span><strong>${last?.sleep ? `${number(last.sleep)} h` : '—'}</strong><small>dernier check-in</small></article>
    </div>

    ${sectionTitle('Cadre de la semaine')}
    <article class="plain-card phase-card"><div><span>Semaine ${state.currentWeek}/6</span><strong>${phase.label}</strong><p>${phase.note}</p></div><div class="phase-line"><i style="width:${(state.currentWeek / 6) * 100}%"></i></div></article>

    ${sectionTitle('Priorités')}
    <div class="priority-list">
      <div><span>01</span><p><strong>Exécution propre</strong>Avant de remettre lourd, on recrée des repères stables.</p></div>
      <div><span>02</span><p><strong>Largeur du haut du corps</strong>Deltoïdes latéraux, dorsaux et haut de pecs sont prioritaires.</p></div>
      <div><span>03</span><p><strong>Recomposition</strong>Le tour de nombril doit baisser pendant que les performances remontent.</p></div>
    </div>

    ${coachCard('Consigne', 'Tu n’as pas besoin de faire plus. Tu dois faire ce qui est prévu, bien, puis récupérer.')}
  `, 'home', 'Aujourd’hui')
  document.querySelector('#startWorkout').onclick = () => go(`workout/${session.id}`)
}

function programPage() {
  const phase = weekPhase()
  shell(`
    ${top('Programme', '4 séances principales + 1 séance technique facultative')}
    <section class="program-intro"><div><p class="kicker">MÉSOCYCLE</p><h2>Recomposition · 6 semaines</h2><p>Fréquence 2×/semaine pour les grands groupes musculaires, volume maîtrisé et progression mesurable.</p></div><span>S${state.currentWeek}</span></section>
    <div class="week-tabs">${phases.map((p) => `<button data-week="${p.week}" class="${state.currentWeek === p.week ? 'active' : ''}">S${p.week}</button>`).join('')}</div>
    <article class="phase-summary"><strong>${phase.label}</strong><span>RIR cible ${phase.rir}</span><p>${phase.note}</p></article>
    ${sectionTitle('Séances')}
    <div class="session-stack">${sessions.map((s, i) => {
      const completed = !!state.sessions[s.id]?.completed
      return `<button class="session-card ${completed ? 'completed' : ''}" data-session="${s.id}"><div class="session-index">${s.optional ? 'OPT' : String(i + 1).padStart(2, '0')}</div><div><h3>${s.name}</h3><p>${s.subtitle}</p><span>${s.duration} · ${s.exercises.length} exercices</span></div><b>${completed ? 'Terminé' : 'Ouvrir'}</b></button>`
    }).join('')}</div>
    ${coachCard('Progression', 'Quand toutes les séries atteignent le haut de la fourchette avec le RIR demandé, augmente légèrement la charge à la prochaine séance.')}
  `, 'program', 'Programme')
  document.querySelectorAll('[data-session]').forEach((el) => el.onclick = () => go(`workout/${el.dataset.session}`))
  document.querySelectorAll('[data-week]').forEach((el) => el.onclick = () => { state.currentWeek = Number(el.dataset.week); save(); programPage() })
}

function exerciseSetRow(sessionId, exIndex, setIndex, ex) {
  const log = workoutState(sessionId).exercises?.[exIndex]?.sets?.[setIndex] || {}
  return `<div class="set-row ${log.done ? 'done' : ''}">
    <button class="set-check" data-done="${exIndex}:${setIndex}" aria-label="Valider la série">${log.done ? '✓' : setIndex + 1}</button>
    <label><span>kg / aide</span><input inputmode="decimal" data-field="weight" data-pos="${exIndex}:${setIndex}" value="${escapeHtml(log.weight || '')}" placeholder="—"></label>
    <label><span>reps</span><input inputmode="numeric" data-field="reps" data-pos="${exIndex}:${setIndex}" value="${escapeHtml(log.reps || '')}" placeholder="${escapeHtml(ex.reps.split('–')[0])}"></label>
    <label><span>RIR</span><input inputmode="numeric" data-field="rir" data-pos="${exIndex}:${setIndex}" value="${escapeHtml(log.rir || '')}" placeholder="${weekPhase().rir.split('–')[0]}"></label>
  </div>`
}

function workoutPage(sessionId) {
  const session = sessions.find((s) => s.id === sessionId) || sessions[0]
  const ws = workoutState(session.id)
  if (!ws.startedAt) { ws.startedAt = new Date().toISOString(); save() }
  shell(`
    <header class="workout-head"><button class="icon-btn" id="backProgram">${icon('back')}</button><div><p class="brandline">${session.name}</p><h1>${session.subtitle}</h1></div><button class="timer-chip" id="timerToggle">Repos</button></header>
    <article class="workout-rule"><span>RIR cible ${weekPhase().rir}</span><p>${weekPhase().note}</p></article>
    <div class="exercise-stack">${session.exercises.map((ex, exIndex) => `<article class="exercise-card"><div class="exercise-top"><div><span>Exercice ${String(exIndex + 1).padStart(2, '0')}</span><h2>${ex.name}</h2></div><b>${ex.sets} × ${ex.reps}</b></div><div class="exercise-cues"><span>Réf. ${ex.ref}</span><p>${ex.cue}</p></div><div class="sets-head"><span>Série</span><span>Charge</span><span>Reps</span><span>RIR</span></div>${Array.from({ length: ex.sets }, (_, setIndex) => exerciseSetRow(session.id, exIndex, setIndex, ex)).join('')}<button class="rest-btn" data-rest="${ex.rest}">${Math.round(ex.rest / 60)}:${String(ex.rest % 60).padStart(2, '0')} repos</button></article>`).join('')}</div>
    <article class="plain-card cardio-card"><div><span>Cardio</span><strong>${session.cardio}</strong></div><label class="switch"><input type="checkbox" id="cardioDone" ${ws.cardio ? 'checked' : ''}><i></i></label></article>
    <article class="plain-card"><label class="textarea-label"><span>Note de séance</span><textarea id="sessionNotes" rows="3" placeholder="Douleur, énergie, exercice à ajuster…">${escapeHtml(ws.notes || '')}</textarea></label></article>
    <button class="btn btn-primary btn-block" id="finishWorkout">Terminer la séance</button>
    <div class="timer-overlay hidden" id="timerOverlay"><div><span>Repos</span><strong id="timerValue">00:00</strong><div><button id="minusTimer">−15 s</button><button id="closeTimer">Fermer</button><button id="plusTimer">+15 s</button></div></div></div>
  `, 'program', session.name)

  document.querySelector('#backProgram').onclick = () => go('program')
  document.querySelectorAll('[data-field]').forEach((el) => el.oninput = () => {
    const [exIndex, setIndex] = el.dataset.pos.split(':').map(Number)
    setLog(session.id, exIndex, setIndex, el.dataset.field, el.value)
  })
  document.querySelectorAll('[data-done]').forEach((el) => el.onclick = () => {
    const [exIndex, setIndex] = el.dataset.done.split(':').map(Number)
    const current = workoutState(session.id).exercises?.[exIndex]?.sets?.[setIndex]?.done || false
    setLog(session.id, exIndex, setIndex, 'done', !current)
    workoutPage(session.id)
  })
  document.querySelectorAll('[data-rest]').forEach((el) => el.onclick = () => startTimer(Number(el.dataset.rest)))
  document.querySelector('#timerToggle').onclick = () => startTimer(90)
  document.querySelector('#closeTimer').onclick = hideTimer
  document.querySelector('#minusTimer').onclick = () => { timerRemaining = Math.max(0, timerRemaining - 15); drawTimer() }
  document.querySelector('#plusTimer').onclick = () => { timerRemaining += 15; drawTimer() }
  document.querySelector('#cardioDone').onchange = (e) => { workoutState(session.id).cardio = e.target.checked; save() }
  document.querySelector('#sessionNotes').oninput = (e) => { workoutState(session.id).notes = e.target.value; save() }
  document.querySelector('#finishWorkout').onclick = () => finishWorkout(session)
}

function startTimer(seconds) {
  timerRemaining = seconds
  document.querySelector('#timerOverlay')?.classList.remove('hidden')
  drawTimer()
  clearInterval(timerHandle)
  timerHandle = setInterval(() => {
    timerRemaining -= 1
    drawTimer()
    if (timerRemaining <= 0) {
      clearInterval(timerHandle)
      if ('vibrate' in navigator) navigator.vibrate([120, 70, 120])
    }
  }, 1000)
}
function drawTimer() {
  const node = document.querySelector('#timerValue')
  if (!node) return
  const min = Math.floor(Math.max(0, timerRemaining) / 60)
  const sec = Math.max(0, timerRemaining) % 60
  node.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
function hideTimer() { document.querySelector('#timerOverlay')?.classList.add('hidden') }

function finishWorkout(session) {
  const ws = workoutState(session.id)
  ws.completed = true
  ws.completedAt = new Date().toISOString()
  const entry = {
    id: `${session.id}-${Date.now()}`,
    sessionId: session.id,
    name: session.name,
    date: TODAY(),
    week: state.currentWeek,
    exercises: clone(ws.exercises),
    cardio: ws.cardio,
    notes: ws.notes,
  }
  state.history.push(entry)
  save()
  go(`summary/${session.id}`)
}

function summaryPage(sessionId) {
  const session = sessions.find((s) => s.id === sessionId) || sessions[0]
  shell(`
    ${top('Séance terminée', session.name)}
    <section class="summary-card"><div class="check-big">✓</div><h2>Enregistrée</h2><p>Les séries, charges, répétitions et RIR sont gardés pour comparer la prochaine séance.</p></section>
    ${coachCard('Après la séance', 'Note seulement ce qui peut influencer la récupération : douleur, sommeil, calories, protéines et sensation générale.')}
    <button class="btn btn-primary btn-block" id="summaryCheckin">Faire le check-in</button>
    <button class="btn btn-secondary btn-block" id="summaryHome">Retour à l’accueil</button>
  `, 'home', 'Résumé')
  document.querySelector('#summaryCheckin').onclick = () => go('checkin')
  document.querySelector('#summaryHome').onclick = () => go('home')
}

function nutritionPage() {
  const day = state.nutritionDays[TODAY()] || { kcal: '', protein: '', fat: '', carbs: '' }
  const pct = day.kcal ? Math.min(100, Math.round((Number(day.kcal) / nutrition.kcal) * 100)) : 0
  shell(`
    ${top('Nutrition', 'Calibration de départ pour la recomposition')}
    <section class="nutrition-hero"><div><p class="kicker">CIBLE QUOTIDIENNE</p><h2>${nutrition.kcal}</h2><span>kcal</span></div>${ring(pct, 'aujourd’hui')}</section>
    <div class="macro-grid"><article><span>Protéines</span><strong>${nutrition.protein} g</strong></article><article><span>Lipides</span><strong>${nutrition.fat} g</strong></article><article><span>Glucides</span><strong>≈ ${nutrition.carbs} g</strong></article><article><span>Créatine</span><strong>${nutrition.creatine}</strong></article></div>
    ${sectionTitle('Saisie du jour')}
    <article class="plain-card food-log"><div class="form-grid"><label>Calories<input id="dayKcal" inputmode="numeric" value="${escapeHtml(day.kcal || '')}" placeholder="2300"></label><label>Protéines<input id="dayProtein" inputmode="numeric" value="${escapeHtml(day.protein || '')}" placeholder="155"></label><label>Lipides<input id="dayFat" inputmode="numeric" value="${escapeHtml(day.fat || '')}" placeholder="70"></label><label>Glucides<input id="dayCarbs" inputmode="numeric" value="${escapeHtml(day.carbs || '')}" placeholder="250"></label></div><button class="btn btn-primary btn-block" id="saveNutrition">Enregistrer la journée</button></article>
    ${sectionTitle('Rythme de nuit')}
    <div class="timeline"><div><b>15:00</b><p>Réveil · premier vrai repas</p></div><div><b>18–20</b><p>Entraînement · repas autour de la séance</p></div><div><b>00–01</b><p>Repas au travail</p></div><div><b>05–06</b><p>Dernier repas ou collation</p></div><div><b>07:30</b><p>Sommeil</p></div></div>
    ${coachCard('Règle nutrition', 'La précision sert à calibrer. Pas de journée parfaite à chercher : moyenne calorique, protéines et régularité d’abord.')}
  `, 'nutrition', 'Nutrition')
  document.querySelector('#saveNutrition').onclick = () => {
    state.nutritionDays[TODAY()] = {
      kcal: document.querySelector('#dayKcal').value,
      protein: document.querySelector('#dayProtein').value,
      fat: document.querySelector('#dayFat').value,
      carbs: document.querySelector('#dayCarbs').value,
    }
    save()
    nutritionPage()
  }
}

function sparkline(points, key) {
  const vals = points.map((p) => Number(p[key])).filter(Number.isFinite)
  if (vals.length < 2) return '<div class="chart-empty">Ajoute au moins deux relevés.</div>'
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const coords = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${44 - ((v - min) / range) * 36}`).join(' ')
  return `<svg class="spark" viewBox="0 0 100 48" preserveAspectRatio="none"><polyline points="${coords}"/></svg>`
}
function progressPage() {
  const latest = latestBody()
  const first = state.body[0] || J0
  const deltaWeight = Number(latest.weight) - Number(first.weight)
  const deltaNavel = Number(latest.navel) - Number(first.navel)
  shell(`
    ${top('Progrès', 'On suit la tendance, pas les variations d’un jour')}
    <div class="metric-grid"><article class="metric"><span>Poids actuel</span><strong>${number(latest.weight)} kg</strong><small>${deltaWeight === 0 ? 'point de départ' : `${deltaWeight > 0 ? '+' : ''}${number(deltaWeight)} kg depuis J0`}</small></article><article class="metric"><span>Nombril</span><strong>${number(latest.navel)} cm</strong><small>${deltaNavel === 0 ? 'point de départ' : `${deltaNavel > 0 ? '+' : ''}${number(deltaNavel)} cm depuis J0`}</small></article></div>
    ${sectionTitle('Poids')}
    <article class="chart-card">${sparkline(state.body.slice(-12), 'weight')}<div class="chart-axis"><span>${dateFr(state.body.at(-12)?.date || first.date)}</span><span>${dateFr(latest.date)}</span></div></article>
    ${sectionTitle('Ajouter un relevé')}
    <article class="plain-card"><div class="form-grid"><label>Poids (kg)<input id="bodyWeight" inputmode="decimal" placeholder="${number(latest.weight)}"></label><label>Nombril (cm)<input id="bodyNavel" inputmode="decimal" placeholder="${number(latest.navel)}"></label></div><button class="btn btn-primary btn-block" id="saveBody">Enregistrer</button></article>
    ${sectionTitle('Point zéro')}
    <div class="measure-list"><div><span>Poitrine</span><b>${J0.chest} cm</b></div><div><span>Taille</span><b>${J0.waist} cm</b></div><div><span>Hanches</span><b>${J0.hips} cm</b></div><div><span>Bras</span><b>${J0.armL} cm</b></div><div><span>Cuisses</span><b>${J0.thighL} cm</b></div><div><span>Mollets</span><b>${J0.calfL} cm</b></div></div>
    ${coachCard('Ce que je regarde', 'Nombril qui baisse, poids relativement stable ou en légère baisse, charges qui remontent et récupération correcte.')}
  `, 'progress', 'Progrès')
  document.querySelector('#saveBody').onclick = () => {
    const w = Number(document.querySelector('#bodyWeight').value.replace(',', '.'))
    const n = Number(document.querySelector('#bodyNavel').value.replace(',', '.'))
    if (!w && !n) return
    state.body.push({ date: TODAY(), weight: w || latest.weight, navel: n || latest.navel })
    save(); progressPage()
  }
}

function checkinPage() {
  shell(`
    ${top('Check-in', '30 secondes pour guider les ajustements')}
    <form class="check-form" id="checkForm">
      <div class="form-grid"><label>Sommeil (h)<input name="sleep" inputmode="decimal" placeholder="7.5" required></label><label>Sensation /10<input name="feeling" inputmode="numeric" placeholder="8" required></label><label>Calories<input name="kcal" inputmode="numeric" placeholder="2300"></label><label>Protéines (g)<input name="protein" inputmode="numeric" placeholder="155"></label></div>
      <label>Douleur ou gêne<select name="pain"><option value="non">Non</option><option value="legere">Légère</option><option value="oui">Oui</option></select></label>
      <label>Commentaire<textarea name="note" rows="4" placeholder="Énergie, douleur précise, faim, stress, séance difficile…"></textarea></label>
      <button class="btn btn-primary btn-block" type="submit">Enregistrer le check-in</button>
    </form>
    ${state.checkins.length ? `${sectionTitle('Derniers check-ins')}<div class="check-history">${state.checkins.slice(-5).reverse().map((c) => `<article><div><strong>${dateFr(c.date)}</strong><span>${number(c.sleep)} h sommeil · ${c.feeling}/10</span></div><b>${c.pain === 'non' ? 'OK' : 'À surveiller'}</b></article>`).join('')}</div>` : ''}
    ${sectionTitle('Rapport coach')}
    <article class="plain-card report-card"><p>Ce rapport regroupe les données utiles à copier dans notre conversation quand tu veux que j’ajuste le programme.</p><button class="btn btn-secondary btn-block" id="copyReport">${icon('copy')} Copier le rapport</button></article>
  `, 'checkin', 'Check-in')
  document.querySelector('#checkForm').onsubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    state.checkins.push({
      date: TODAY(), sleep: fd.get('sleep'), feeling: fd.get('feeling'), kcal: fd.get('kcal'), protein: fd.get('protein'), pain: fd.get('pain'), note: fd.get('note')
    })
    save(); checkinPage()
  }
  document.querySelector('#copyReport').onclick = async () => {
    const report = coachReport()
    try { await navigator.clipboard.writeText(report); document.querySelector('#copyReport').textContent = 'Rapport copié' }
    catch { window.prompt('Copie ce rapport :', report) }
  }
}

function coachReport() {
  const body = latestBody()
  const lastCheck = latestCheckin()
  const recent = state.history.slice(-4)
  return [
    'APEX — RAPPORT COACH',
    `Date: ${TODAY()}`,
    `Semaine: ${state.currentWeek}/6 (${weekPhase().label})`,
    `Poids: ${body.weight ?? '—'} kg`,
    `Nombril: ${body.navel ?? '—'} cm`,
    lastCheck ? `Sommeil: ${lastCheck.sleep || '—'} h | Sensation: ${lastCheck.feeling || '—'}/10 | Douleur: ${lastCheck.pain || '—'}` : 'Check-in: aucun',
    lastCheck ? `Nutrition: ${lastCheck.kcal || '—'} kcal | ${lastCheck.protein || '—'} g protéines` : '',
    `Séances récentes: ${recent.length ? recent.map((h) => `${h.date} ${h.name}`).join(' | ') : 'aucune'}`,
    lastCheck?.note ? `Note: ${lastCheck.note}` : '',
  ].filter(Boolean).join('\n')
}

function route() {
  const raw = getRoute()
  if (raw.startsWith('workout/')) return workoutPage(raw.split('/')[1])
  if (raw.startsWith('summary/')) return summaryPage(raw.split('/')[1])
  if (raw === 'program') return programPage()
  if (raw === 'nutrition') return nutritionPage()
  if (raw === 'progress') return progressPage()
  if (raw === 'checkin') return checkinPage()
  return homePage()
}

window.addEventListener('hashchange', route)
route()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}))
}
