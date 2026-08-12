import { getState, getLive, findSession } from '../state.js'
import { esc, logoMark, relativeDays, formatDate } from '../ui.js'

export default function homeView(root) {
  const state = getState()
  const live = getLive()
  const liveSession = live ? findSession(live.sessionId) : null

  const cards = state.program
    .map((s) => {
      const pending = s.exercises.filter((e) => e.pending && e.pending.delta !== 0).length
      const last = s.lastDoneAt
      return `
      <a class="card session-card" href="#/seance/${esc(s.id)}">
        <div class="session-card__main">
          <h2 class="session-card__name">${esc(s.name)}</h2>
          <p class="session-card__sub">${esc(s.subtitle)}</p>
          <p class="session-card__meta">
            ${last ? `${esc(formatDate(last))} · ${esc(relativeDays(last))}` : 'Jamais faite'}
            · ${s.exercises.length} exos
          </p>
        </div>
        <div class="session-card__side">
          ${pending ? `<span class="chip chip--gold">🎯 ${pending}</span>` : ''}
          <span class="session-card__go">›</span>
        </div>
      </a>`
    })
    .join('')

  root.innerHTML = `
    <div class="page page--home">
      <header class="brand">
        <span class="brand__mark">${logoMark(34)}</span>
        <span class="brand__word">APEX</span>
      </header>
      <p class="brand__tagline">Le poids monte quand les reps sont là.</p>

      ${
        live && liveSession
          ? `<a class="card live-banner" href="#/seance/${esc(live.sessionId)}/workout">
              <div>
                <p class="live-banner__kicker">Séance en cours</p>
                <p class="live-banner__name">${esc(liveSession.name)}</p>
              </div>
              <span class="btn btn--gold btn--sm">Reprendre</span>
            </a>`
          : ''
      }

      <h3 class="section-title">Séances</h3>
      <div class="stack">${cards}</div>

      <nav class="home-nav">
        <a class="card nav-card" href="#/historique">
          <span class="nav-card__label">Historique</span>
          <span class="nav-card__meta">${state.history.length} séance${state.history.length > 1 ? 's' : ''}</span>
        </a>
        <a class="card nav-card" href="#/reglages">
          <span class="nav-card__label">Réglages</span>
          <span class="nav-card__meta">Sauvegarde &amp; données</span>
        </a>
      </nav>

      <p class="footnote">Données stockées sur cet appareil uniquement.</p>
    </div>`
}
