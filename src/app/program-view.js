import { phases, sessions } from './config.js'
import { save, state } from './store.js'
import { esc, go, shell, top } from './ui.js'

function sessionKey(id) {
  return `${state.currentWeek}:${id}`
}

function isDone(id) {
  return !!state.sessions?.[sessionKey(id)]?.completed
}

function mandatorySessions() {
  return sessions.filter((session) => !session.optional)
}

function nextSession() {
  return mandatorySessions().find((session) => !isDone(session.id)) || mandatorySessions()[0]
}

function phase() {
  return phases[state.currentWeek - 1] || phases[0]
}

function sessionName(id) {
  return sessions.find((session) => session.id === id)?.name || id || 'Séance'
}

function dateLabel(value) {
  if (!value) return '—'
  const raw = String(value).slice(0, 10)
  const date = new Date(`${raw}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' })
}

function completedSetCount(entry) {
  const exercises = entry?.exercises || {}
  return Object.values(exercises).reduce((total, exercise) => {
    const rows = Array.isArray(exercise?.sets) ? exercise.sets : []
    return total + rows.filter((row) => row?.done).length
  }, 0)
}

export function programPage() {
  const currentPhase = phase()
  const mandatory = mandatorySessions()
  const next = nextSession()
  const completed = mandatory.filter((session) => isDone(session.id)).length
  const pct = Math.round(completed / mandatory.length * 100)
  const history = [...(state.history || [])]
    .sort((a, b) => String(b.updatedAt || b.date || '').localeCompare(String(a.updatedAt || a.date || '')))
    .slice(0, 4)

  shell(`
    ${top('Entraînement', 'Programme, progression et historique')}

    <section class="v3-training-hero">
      <div class="v3-training-hero__top">
        <div><span>SEMAINE ${state.currentWeek} · ${esc(currentPhase.label.toUpperCase())}</span><strong>${completed}/4 séances réalisées</strong></div>
        <b>${pct}%</b>
      </div>
      <div class="v3-training-hero__progress"><i style="width:${pct}%"></i></div>
      <div class="v3-training-next">
        <div><span>PROCHAINE SÉANCE</span><h2>${esc(next.name)}</h2><p>${esc(next.subtitle)} · ${esc(next.duration)}</p></div>
        <button data-session="${next.id}">Démarrer <b>›</b></button>
      </div>
      <div class="v3-training-rule"><span>RIR ${esc(currentPhase.rir)}</span><p>${esc(currentPhase.note)}</p></div>
    </section>

    <section class="v3-cycle">
      <div class="v3-section-title"><div><span>CYCLE ACTUEL</span><h2>6 semaines</h2></div><small>${state.currentWeek === 6 ? 'Deload actif' : 'Progression contrôlée'}</small></div>
      <div class="v3-cycle-track">
        ${phases.map((item) => `<button data-week="${item.week}" class="${item.week === state.currentWeek ? 'active' : item.week < state.currentWeek ? 'past' : ''}"><b>S${item.week}</b><span>${esc(item.label)}</span></button>`).join('')}
      </div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>CETTE SEMAINE</span><h2>Programme</h2></div><small>4 obligatoires + 1 technique</small></div>
      <div class="v3-session-list">
        ${mandatory.map((session, index) => {
          const done = isDone(session.id)
          const active = session.id === next.id && !done
          return `<button data-session="${session.id}" class="v3-session-row ${done ? 'done' : ''} ${active ? 'next' : ''}">
            <span class="v3-session-number">${String(index + 1).padStart(2, '0')}</span>
            <span class="v3-session-copy"><strong>${esc(session.name)}</strong><small>${esc(session.subtitle)}</small><em>${esc(session.duration)} · ${state.currentWeek === 6 ? 'volume deload' : `${session.exercises.length} exercices`}</em></span>
            <span class="v3-session-state">${done ? 'Terminé' : active ? 'À faire' : 'À venir'}</span>
          </button>`
        }).join('')}
      </div>
      ${sessions.filter((session) => session.optional).map((session) => `<button data-session="${session.id}" class="v3-skill-row"><div><span>TECHNIQUE FACULTATIVE</span><strong>${esc(session.name)}</strong><small>${esc(session.subtitle)} · ${esc(session.duration)}</small></div><b>›</b></button>`).join('')}
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>HISTORIQUE</span><h2>Dernières séances</h2></div><small>${state.history?.length || 0} enregistrée${(state.history?.length || 0) > 1 ? 's' : ''}</small></div>
      <div class="v3-history-list">
        ${history.length ? history.map((entry) => `<article>
          <time>${dateLabel(entry.date || entry.updatedAt)}</time>
          <div><strong>${esc(sessionName(entry.sessionId))}</strong><span>${completedSetCount(entry)} séries validées${entry.week ? ` · S${entry.week}` : ''}</span></div>
          <b>✓</b>
        </article>`).join('') : '<div class="v3-empty-state"><strong>Ton historique commence ici.</strong><p>Après ta première séance, APEX affichera tes dernières performances et tes repères.</p></div>'}
      </div>
    </section>

    <section class="v3-progression-note">
      <span>RÈGLE DE PROGRESSION</span>
      <strong>Technique d’abord, surcharge ensuite.</strong>
      <p>Atteins le haut de la plage de répétitions au RIR demandé avant d’augmenter légèrement la charge. Pour tractions et dips assistés, moins d’assistance = progression.</p>
    </section>
  `, 'program')

  document.querySelectorAll('[data-session]').forEach((button) => {
    button.onclick = () => go(`workout/${button.dataset.session}`)
  })

  document.querySelectorAll('[data-week]').forEach((button) => {
    button.onclick = () => {
      state.currentWeek = Number(button.dataset.week)
      save()
      programPage()
    }
  })
}
