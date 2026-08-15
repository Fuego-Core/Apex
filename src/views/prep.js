import { getLive, setLive, findSession, save } from '../state.js'
import { navigate } from '../main.js'
import { esc, header, kg, mmss, restLabel, toast, confirmDialog, relativeDays, transitionTo } from '../ui.js'

/** Prépare les séries pré-remplies d'une séance à partir du programme. */
function buildLive(session) {
  return {
    sessionId: session.id,
    startedAt: new Date().toISOString(),
    entries: session.exercises.map((ex) => ({
      instanceId: ex.id,
      sets: Array.from({ length: ex.sets }, () => ({
        warmup: false,
        done: false,
        reps: ex.mode === 'reps' ? ex.repMax : null,
        weight: ex.mode === 'reps' ? ex.weight : 0,
        seconds: ex.mode === 'temps' ? ex.secMax : null
      }))
    }))
  }
}

export default function prepView(root, { sessionId }) {
  const session = findSession(sessionId)
  if (!session) {
    navigate('#/')
    return
  }

  const live = getLive()
  if (live && live.sessionId === sessionId) {
    navigate(`#/seance/${sessionId}/workout`)
    return
  }

  function render() {
    const s = findSession(sessionId)
    const moves = s.exercises.filter((e) => e.pending && e.pending.delta !== 0)
    const holds = s.exercises.filter((e) => e.pending && e.pending.delta === 0)

    const moveRows = moves
      .map(
        (e) => `
      <div class="card suggest" data-ex="${esc(e.id)}">
        <div class="suggest__head">
          <p class="suggest__name">${esc(e.name)}</p>
          <span class="badge badge--${e.pending.status === 'progression' ? 'gold' : 'warn'}">
            ${e.pending.status === 'progression' ? 'Progression 🎯' : 'Trop lourd'}
          </span>
        </div>
        <p class="suggest__why">${esc(e.pending.message)}</p>
        <p class="suggest__jump">
          <span class="suggest__old">${esc(kg(e.pending.from))}</span>
          <span class="suggest__arrow">→</span>
          <span class="suggest__new">${esc(kg(e.pending.suggested))}</span>
        </p>
        <div class="suggest__actions">
          <button class="btn btn--ghost" data-act="keep" data-ex="${esc(e.id)}">Garder ${esc(kg(e.pending.from))}</button>
          <button class="btn btn--gold" data-act="accept" data-ex="${esc(e.id)}">Accepter ${esc(kg(e.pending.suggested))}</button>
        </div>
      </div>`
      )
      .join('')

    const holdRows = holds.length
      ? `<div class="card soft">
          <p class="soft__title">On garde le même poids</p>
          <ul class="soft__list">
            ${holds
              .map(
                (e) =>
                  `<li><strong>${esc(e.name)}</strong> · ${esc(kg(e.weight))} — ${esc(e.pending.message)}</li>`
              )
              .join('')}
          </ul>
          <button class="btn btn--ghost btn--block" data-act="clear-holds">C'est noté</button>
        </div>`
      : ''

    const planRows = s.exercises
      .map((ex) => {
        const target =
          ex.mode === 'reps'
            ? `${ex.sets} × ${ex.repMin}-${ex.repMax} · ${kg(ex.weight)}${ex.assisted ? ' (assist.)' : ''}`
            : `${ex.sets} × ${mmss(ex.secMin)}${ex.secMax !== ex.secMin ? `-${mmss(ex.secMax)}` : ''}`
        return `<li class="plan__row">
            <span class="plan__name">${esc(ex.name)}</span>
            <span class="plan__target">${esc(target)}</span>
            <span class="plan__rest">${esc(restLabel(ex.rest))}</span>
          </li>`
      })
      .join('')

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/', title: s.name, sub: s.subtitle })}

        ${
          moves.length
            ? `<section class="hero-gold">
                <p class="hero-gold__kicker">Pense-bête</p>
                <h2 class="hero-gold__title">Aujourd'hui ça monte 🎯</h2>
                <p class="hero-gold__sub">${moves.length} ajustement${moves.length > 1 ? 's' : ''} proposé${moves.length > 1 ? 's' : ''} par le moteur.</p>
              </section>
              <div class="stack">${moveRows}</div>
              ${moves.length > 1 ? `<button class="btn btn--ghost btn--block" data-act="accept-all">Tout accepter</button>` : ''}`
            : `<section class="hero-flat">
                <h2 class="hero-flat__title">Rien à ajuster</h2>
                <p class="hero-flat__sub">${
                  s.lastDoneAt
                    ? `Dernière ${esc(s.name)} ${esc(relativeDays(s.lastDoneAt))}. On repart sur les poids courants.`
                    : 'Première fois sur cette séance : on part sur les poids du programme.'
                }</p>
              </section>`
        }

        ${holdRows}

        <h3 class="section-title">Au programme</h3>
        <ul class="card plan">${planRows}</ul>

        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="start">Commencer la séance</button>
        </div>
      </div>`

    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', onAction)
    })
  }

  async function onAction(e) {
    const act = e.currentTarget.dataset.act
    const exId = e.currentTarget.dataset.ex
    const s = findSession(sessionId)

    if (act === 'accept' || act === 'keep') {
      const ex = s.exercises.find((x) => x.id === exId)
      if (!ex || !ex.pending) return
      if (act === 'accept') {
        ex.weight = ex.pending.suggested
        toast(`${ex.name} : ${kg(ex.weight)} pour aujourd'hui`, 'gold')
      } else {
        toast(`${ex.name} : on reste à ${kg(ex.weight)}`)
      }
      ex.pending = null
      save()
      render()
      return
    }

    if (act === 'accept-all') {
      s.exercises.forEach((ex) => {
        if (ex.pending && ex.pending.delta !== 0) {
          ex.weight = ex.pending.suggested
          ex.pending = null
        }
      })
      save()
      toast('Nouveaux poids appliqués 🎯', 'gold')
      render()
      return
    }

    if (act === 'clear-holds') {
      s.exercises.forEach((ex) => {
        if (ex.pending && ex.pending.delta === 0) ex.pending = null
      })
      save()
      render()
      return
    }

    if (act === 'start') {
      const live = getLive()
      if (live && live.sessionId !== sessionId) {
        const other = findSession(live.sessionId)
        const ok = await confirmDialog({
          title: 'Séance en cours',
          message: `Une séance ${other ? other.name : ''} est déjà ouverte. La démarrer efface la précédente.`,
          confirmLabel: 'Démarrer quand même',
          danger: true
        })
        if (!ok) return
      }
      // Les suggestions non traitées sont considérées comme "gardées".
      s.exercises.forEach((ex) => {
        ex.pending = null
      })
      save()
      setLive(buildLive(s))
      // On entre dans la séance : voile, fil d'or, puis l'effort.
      transitionTo(`#/seance/${sessionId}/workout`)
    }
  }

  render()
}
