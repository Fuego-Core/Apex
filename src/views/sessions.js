/* LISTE DES SÉANCES — le programme complet.
   Le tableau de bord ne montre que la séance du jour ; ici on voit les cinq,
   avec la date du dernier passage et les ajustements en attente. */

import { getState, getLive, findSession } from '../state.js'
import { esc, header, relativeDays, formatDate } from '../ui.js'

export default function sessionsView(root) {
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
    <div class="page">
      ${header({ title: 'Entraînement', sub: `${state.program.length} séances au programme` })}

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

      <div class="stack">${cards}</div>

      <p class="footnote">Le poids monte quand les reps sont là.</p>
    </div>`
}
