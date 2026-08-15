import { getState, getLive, setLive, findSession, save } from '../state.js'
import { navigate } from '../main.js'
import { evaluate, tonnage, workSets, PROGRESSION, TROP_LOURD, LOG } from '../core/engine.js'
import { esc, header, kg, num, mmss, duration, uid, toast } from '../ui.js'

/** Meilleur poids déjà enregistré pour ce MOUVEMENT, toutes séances confondues.
 *  L'identité passe par l'id du catalogue : renommer un exercice ne casse plus
 *  son historique, et Push et Upper partagent le même record. */
function previousBest(history, exerciseId) {
  let best = 0
  history.forEach((h) => {
    h.entries.forEach((e) => {
      if (e.exerciseId !== exerciseId || e.mode !== 'reps' || e.assisted) return
      e.sets.forEach((s) => {
        if (!s.warmup && s.done) best = Math.max(best, Number(s.weight) || 0)
      })
    })
  })
  return best
}

export default function summaryView(root, { sessionId }) {
  const state = getState()
  const session = findSession(sessionId)
  const live = getLive()

  if (!session || !live || live.sessionId !== sessionId) {
    navigate('#/')
    return
  }

  const endedAt = new Date()
  const durationSec = Math.max(
    0,
    Math.round((endedAt.getTime() - new Date(live.startedAt).getTime()) / 1000)
  )

  const results = session.exercises.map((ex) => {
    const entry = live.entries.find((e) => e.instanceId === ex.id)
    const sets = entry ? entry.sets : []
    const verdict = evaluate(ex, sets)
    const best = previousBest(state.history, ex.exerciseId)
    // Un record se bat : à la toute première séance, il n'y a rien à battre.
    // Et un poids qui t'a écrasé (série sous le plancher) n'est pas un record.
    const record =
      ex.mode === 'reps' &&
      !ex.assisted &&
      workSets(sets).length > 0 &&
      verdict.status !== TROP_LOURD &&
      best > 0 &&
      verdict.weightUsed > best
    return { ex, sets, verdict, tons: tonnage(ex, sets), record }
  })

  const totalTonnage = results.reduce((a, r) => a + r.tons, 0)
  const totalSets = results.reduce((a, r) => a + workSets(r.sets).length, 0)
  const progressions = results.filter((r) => r.verdict.status === PROGRESSION).length

  const rows = results
    .map(({ ex, sets, verdict, tons, record }) => {
      const done = workSets(sets)
      const detail =
        ex.mode === 'reps'
          ? done.map((s) => `${s.reps}`).join(' · ') || '—'
          : done.map((s) => mmss(s.seconds)).join(' · ') || '—'
      const tone =
        verdict.status === PROGRESSION ? 'gold' : verdict.status === TROP_LOURD ? 'warn' : 'flat'
      const skipped = !verdict.status
      return `
      <article class="card result result--${tone} ${skipped ? 'result--skipped' : ''}">
        <div class="result__head">
          <p class="result__name">${esc(ex.name)}</p>
          ${record ? '<span class="badge badge--gold">Record 🏆</span>' : ''}
        </div>
        <p class="result__sets">${esc(detail)}${ex.mode === 'reps' && done.length ? ` reps · ${esc(kg(verdict.weightUsed))}` : ''}</p>
        <p class="result__status">
          <span class="badge badge--${tone}">${esc(verdict.title)}</span>
          ${tons ? `<span class="result__tons">${esc(num(tons))} kg soulevés</span>` : ''}
        </p>
        <p class="result__msg">${esc(verdict.message)}</p>
        ${verdict.mixed ? `<p class="warn-box">⚠️ 1 exo = 1 poids — les montées, c'est l'échauffement.</p>` : ''}
      </article>`
    })
    .join('')

  /* Le moment record : quand la séance en contient un, l'écran s'assombrit,
     le chiffre apparaît, une ligne d'or se dessine — puis tout revient au
     calme. Une seule fois, ~1,5 s, et jamais si l'utilisateur préfère
     réduire les animations (le badge Record reste, lui, toujours visible). */
  function prMoment() {
    const best = results.find((r) => r.record)
    if (!best || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = document.createElement('div')
    el.className = 'pr-moment'
    el.innerHTML = `
      <div>
        <p class="pr-moment__kicker">Record personnel</p>
        <p class="pr-moment__value">${esc(kg(best.verdict.weightUsed))}</p>
        <p class="pr-moment__name">${esc(best.ex.name)}</p>
        <div class="pr-moment__line"></div>
      </div>`
    document.getElementById('overlay').appendChild(el)
    requestAnimationFrame(() => el.classList.add('is-in'))
    if (getState().settings.vibration) navigator.vibrate?.([14, 60, 14])
    setTimeout(() => {
      el.classList.remove('is-in')
      setTimeout(() => el.remove(), 320)
    }, 1500)
  }
  prMoment()

  root.innerHTML = `
    <div class="page">
      ${header({ back: `#/seance/${esc(sessionId)}/workout`, title: 'Résumé', sub: session.name })}

      <section class="stats">
        <div class="stat">
          <p class="stat__value">${esc(duration(durationSec))}</p>
          <p class="stat__label">Durée</p>
        </div>
        <div class="stat">
          <p class="stat__value">${esc(num(Math.round(totalTonnage)))}</p>
          <p class="stat__label">Tonnage (kg)</p>
        </div>
        <div class="stat">
          <p class="stat__value">${totalSets}</p>
          <p class="stat__label">Séries</p>
        </div>
        <div class="stat ${progressions ? 'stat--gold' : ''}">
          <p class="stat__value">${progressions}</p>
          <p class="stat__label">Progressions 🎯</p>
        </div>
      </section>

      <h3 class="section-title">Verdict du moteur</h3>
      <div class="stack">${rows}</div>

      <div class="sticky-actions">
        <button class="btn btn--gold btn--block btn--lg" data-act="archive">Terminer</button>
      </div>
    </div>`

  root.querySelector('[data-act="archive"]').addEventListener('click', () => {
    const entry = {
      id: uid('h'),
      sessionId: session.id,
      sessionName: session.name,
      startedAt: live.startedAt,
      endedAt: endedAt.toISOString(),
      durationSec,
      tonnage: Math.round(totalTonnage),
      entries: results.map(({ ex, sets, verdict, record }) => ({
        // Identité du mouvement (catalogue) + emplacement dans le programme.
        exerciseId: ex.exerciseId,
        instanceId: ex.id,
        name: ex.name,
        mode: ex.mode,
        assisted: ex.assisted,
        repMin: ex.repMin ?? null,
        repMax: ex.repMax ?? null,
        status: verdict.status,
        weightUsed: verdict.weightUsed,
        suggested: verdict.suggested,
        record,
        sets: sets.map((s) => ({
          warmup: !!s.warmup,
          done: !!s.done,
          reps: s.reps ?? null,
          weight: s.weight ?? null,
          seconds: s.seconds ?? null
        }))
      }))
    }

    state.history.unshift(entry)
    session.lastDoneAt = endedAt.toISOString()

    // Le moteur laisse ses suggestions pour le pense-bête de la prochaine fois.
    results.forEach(({ ex, verdict }) => {
      if (!verdict.status || verdict.status === LOG) {
        ex.pending = null
        return
      }
      ex.pending = {
        status: verdict.status,
        from: verdict.weightUsed,
        suggested: verdict.suggested,
        delta: verdict.delta,
        message: verdict.message,
        at: endedAt.toISOString()
      }
    })

    save()
    setLive(null)
    toast(
      progressions ? `Séance archivée · ${progressions} progression${progressions > 1 ? 's' : ''} 🎯` : 'Séance archivée',
      progressions ? 'gold' : 'neutral'
    )
    navigate('#/')
  })
}
