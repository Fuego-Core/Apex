import { getLive, setLive, findSession, save } from '../state.js'
import { navigate } from '../main.js'
import { openTimer } from '../timer.js'
import { isMixedWeight, round } from '../engine.js'
import { esc, header, kg, num, mmss, restLabel, duration, toast, confirmDialog } from '../ui.js'

export default function workoutView(root, { sessionId }) {
  const session = findSession(sessionId)
  const live = getLive()

  if (!session) {
    navigate('#/')
    return
  }
  if (!live || live.sessionId !== sessionId || !live.entries?.length) {
    navigate(`#/seance/${sessionId}`)
    return
  }

  const exOf = (id) => session.exercises.find((e) => e.id === id)
  const entryOf = (id) => live.entries.find((e) => e.exerciseId === id)

  function persist() {
    setLive(live)
  }

  /* ---------- rendu ---------- */

  function setRow(ex, entry, i) {
    const s = entry.sets[i]
    const label = s.warmup ? 'É' : String(entry.sets.slice(0, i + 1).filter((x) => !x.warmup).length)
    const d = `data-ex="${esc(ex.id)}" data-i="${i}"`

    const body =
      ex.mode === 'reps'
        ? `<div class="field">
             <button class="field__step" data-act="step" ${d} data-field="reps" data-by="-1" aria-label="Moins une rep">−</button>
             <input class="field__input" inputmode="numeric" pattern="[0-9]*" data-input="reps" ${d} value="${s.reps ?? ''}" aria-label="Répétitions">
             <button class="field__step" data-act="step" ${d} data-field="reps" data-by="1" aria-label="Plus une rep">+</button>
             <span class="field__unit">reps</span>
           </div>
           <label class="set__weight">
             <input class="set__weight-input" inputmode="decimal" data-input="weight" ${d} value="${num(s.weight)}" aria-label="Poids de la série">
             <span class="set__weight-unit">kg</span>
           </label>`
        : `<div class="field">
             <button class="field__step" data-act="step" ${d} data-field="seconds" data-by="-1" aria-label="Moins de temps">−</button>
             <span class="field__value" data-input-display="seconds" ${d}>${mmss(s.seconds)}</span>
             <button class="field__step" data-act="step" ${d} data-field="seconds" data-by="1" aria-label="Plus de temps">+</button>
             <span class="field__unit">min:sec</span>
           </div>
           <button class="set__chrono" data-act="chrono" ${d} aria-label="Lancer le chrono">⏱</button>`

    return `
      <div class="set ${s.done ? 'is-done' : ''} ${s.warmup ? 'is-warmup' : ''}" data-set="${esc(ex.id)}-${i}">
        <span class="set__n" title="${s.warmup ? 'Échauffement (hors moteur)' : 'Série de travail'}">${label}</span>
        ${body}
        <button class="set__ok" data-act="toggle" ${d} aria-label="Valider la série"></button>
        <button class="set__del" data-act="del-set" ${d} aria-label="Supprimer la série">×</button>
      </div>`
  }

  function exerciseCard(ex) {
    const entry = entryOf(ex.id)
    // Exercice ajouté au programme après le début de la séance : rien à saisir ici.
    if (!entry) return ''
    const done = entry.sets.filter((s) => s.done).length
    const complete = done > 0 && done === entry.sets.length
    const mixed = ex.mode === 'reps' && isMixedWeight(entry.sets)

    const target =
      ex.mode === 'reps'
        ? `${ex.sets} × ${ex.repMin}-${ex.repMax}`
        : `${ex.sets} × ${mmss(ex.secMin)}${ex.secMax !== ex.secMin ? ` – ${mmss(ex.secMax)}` : ''}`

    return `
      <article class="card exo ${complete ? 'is-complete' : ''}" data-card="${esc(ex.id)}">
        <div class="exo__head">
          <div>
            <h2 class="exo__name">${esc(ex.name)}</h2>
            <p class="exo__target">
              ${esc(target)}
              ${ex.assisted ? '· <span class="tag">assisté</span>' : ''}
              · repos ${esc(restLabel(ex.rest))}
            </p>
            ${ex.note ? `<p class="exo__note">« ${esc(ex.note)} »</p>` : ''}
          </div>
          <button class="icon-btn" data-act="edit" data-ex="${esc(ex.id)}" aria-label="Modifier l'exercice">⚙</button>
        </div>

        ${
          ex.assisted
            ? `<p class="exo__hint">Assistance : progresser = <strong>réduire</strong> le poids.</p>`
            : ''
        }

        ${
          ex.mode === 'reps'
            ? `<div class="weightbar">
                 <button class="weightbar__step" data-act="ex-weight" data-ex="${esc(ex.id)}" data-by="-1" aria-label="Retirer ${esc(num(ex.increment))} kg">−</button>
                 <div class="weightbar__value">
                   <span class="weightbar__num">${esc(num(ex.weight))}</span>
                   <span class="weightbar__unit">kg</span>
                 </div>
                 <button class="weightbar__step" data-act="ex-weight" data-ex="${esc(ex.id)}" data-by="1" aria-label="Ajouter ${esc(num(ex.increment))} kg">+</button>
               </div>
               <p class="weightbar__hint">pas de ${esc(num(ex.increment))} kg · s'applique à toutes les séries</p>`
            : ''
        }

        <div class="sets">${entry.sets.map((_, i) => setRow(ex, entry, i)).join('')}</div>

        ${
          mixed
            ? `<p class="warn-box">⚠️ 1 exo = 1 poids — les montées, c'est l'échauffement.</p>`
            : ''
        }

        <div class="exo__actions">
          <button class="btn btn--ghost btn--sm" data-act="add-warmup" data-ex="${esc(ex.id)}">+ Échauffement</button>
          <button class="btn btn--ghost btn--sm" data-act="add-set" data-ex="${esc(ex.id)}">+ Série</button>
        </div>
      </article>`
  }

  function refreshCard(exId) {
    const card = root.querySelector(`[data-card="${CSS.escape(exId)}"]`)
    if (!card) return renderAll()
    const tmp = document.createElement('div')
    tmp.innerHTML = exerciseCard(exOf(exId))
    card.replaceWith(tmp.firstElementChild)
    refreshProgress()
  }

  function totals() {
    let done = 0
    let total = 0
    live.entries.forEach((entry) => {
      entry.sets.forEach((s) => {
        total++
        if (s.done) done++
      })
    })
    return { done, total }
  }

  function refreshProgress() {
    const { done, total } = totals()
    const bar = root.querySelector('[data-progress-bar]')
    const label = root.querySelector('[data-progress-label]')
    if (bar) bar.style.width = `${total ? (done / total) * 100 : 0}%`
    if (label) label.textContent = `${done}/${total} séries`
  }

  function renderAll() {
    root.innerHTML = `
      <div class="page page--workout">
        ${header({ back: '#/', title: session.name, sub: session.subtitle })}
        <div class="progress">
          <div class="progress__track"><div class="progress__bar" data-progress-bar></div></div>
          <div class="progress__meta">
            <span data-progress-label>0/0 séries</span>
            <span data-chrono>0 s</span>
          </div>
        </div>
        <div class="stack">${session.exercises.map(exerciseCard).join('')}</div>
        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="finish">Terminer la séance</button>
          <button class="btn btn--ghost btn--block" data-act="abandon">Abandonner</button>
        </div>
      </div>`
    refreshProgress()
    tickChrono()
  }

  /* ---------- chrono de séance ---------- */

  function tickChrono() {
    const el = root.querySelector('[data-chrono]')
    if (!el) return
    const sec = Math.round((Date.now() - new Date(live.startedAt).getTime()) / 1000)
    el.textContent = duration(sec)
  }
  const chronoTimer = setInterval(tickChrono, 1000)

  /* ---------- interactions ---------- */

  function stepValue(ex, s, field, by) {
    if (field === 'reps') {
      s.reps = Math.max(0, (Number(s.reps) || 0) + by)
    } else if (field === 'weight') {
      const inc = Number(ex.increment) || 2.5
      s.weight = Math.max(0, round((Number(s.weight) || 0) + by * inc))
    } else if (field === 'seconds') {
      s.seconds = Math.max(0, (Number(s.seconds) || 0) + by * 15)
    }
  }

  async function validateSet(ex, entry, i) {
    const s = entry.sets[i]
    s.done = !s.done
    persist()
    refreshCard(ex.id)

    if (!s.done) return

    // Repos automatique, sauf si tout est terminé ou si l'exo n'a pas de repos.
    const { done, total } = totals()
    if (ex.rest > 0 && done < total) {
      await openTimer({
        seconds: ex.rest,
        kind: 'repos',
        title: esc(ex.name),
        sub: ex.mode === 'reps' ? `${s.reps} reps · ${kg(s.weight)}` : `${mmss(s.seconds)}`
      })
    }
  }

  async function runChrono(ex, entry, i) {
    const s = entry.sets[i]
    const targetSec = Number(s.seconds) || ex.secMax || ex.secMin || 60
    const res = await openTimer({
      seconds: targetSec,
      kind: 'effort',
      title: esc(ex.name),
      sub: `Objectif ${mmss(targetSec)}`
    })
    s.seconds = res.completed ? targetSec : Math.max(1, res.elapsed)
    s.done = true
    persist()
    refreshCard(ex.id)

    const { done, total } = totals()
    if (ex.rest > 0 && done < total) {
      await openTimer({ seconds: ex.rest, kind: 'repos', title: esc(ex.name), sub: `${mmss(s.seconds)} enregistrées` })
    }
  }

  function openEditor(ex) {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'modal'
    const isReps = ex.mode === 'reps'
    wrap.innerHTML = `
      <form class="modal__card modal__card--sheet">
        <h3 class="modal__title">${esc(ex.name)}</h3>
        <div class="form-grid">
          ${
            isReps
              ? `<label class="form-row"><span>Poids courant (kg)</span><input name="weight" inputmode="decimal" value="${num(ex.weight)}"></label>
                 <label class="form-row"><span>Incrément (kg)</span><input name="increment" inputmode="decimal" value="${num(ex.increment)}"></label>
                 <label class="form-row"><span>Reps min</span><input name="repMin" inputmode="numeric" value="${ex.repMin}"></label>
                 <label class="form-row"><span>Reps max</span><input name="repMax" inputmode="numeric" value="${ex.repMax}"></label>`
              : `<label class="form-row"><span>Durée cible (s)</span><input name="secMax" inputmode="numeric" value="${ex.secMax}"></label>
                 <label class="form-row"><span>Durée mini (s)</span><input name="secMin" inputmode="numeric" value="${ex.secMin}"></label>`
          }
          <label class="form-row"><span>Repos (s)</span><input name="rest" inputmode="numeric" value="${ex.rest}"></label>
          <label class="form-row form-row--full"><span>Note</span><input name="note" value="${esc(ex.note)}"></label>
          ${
            isReps
              ? `<label class="form-row form-row--check"><input type="checkbox" name="assisted" ${ex.assisted ? 'checked' : ''}><span>Exercice assisté (progresser = réduire le poids)</span></label>`
              : ''
          }
        </div>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Annuler</button>
          <button type="submit" class="btn btn--gold">Enregistrer</button>
        </div>
      </form>`

    const close = () => wrap.remove()
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-act="cancel"]')) close()
    })
    wrap.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      const numOr = (key, fallback) => {
        const v = parseFloat(String(f.get(key) ?? '').replace(',', '.'))
        return Number.isFinite(v) ? v : fallback
      }
      if (ex.mode === 'reps') {
        ex.weight = Math.max(0, numOr('weight', ex.weight))
        ex.increment = Math.max(0, numOr('increment', ex.increment))
        ex.repMin = Math.max(1, Math.round(numOr('repMin', ex.repMin)))
        ex.repMax = Math.max(ex.repMin, Math.round(numOr('repMax', ex.repMax)))
        ex.assisted = f.get('assisted') === 'on'
      } else {
        ex.secMax = Math.max(1, Math.round(numOr('secMax', ex.secMax)))
        ex.secMin = Math.max(1, Math.round(numOr('secMin', ex.secMin)))
      }
      ex.rest = Math.max(0, Math.round(numOr('rest', ex.rest)))
      ex.note = String(f.get('note') || '').slice(0, 200)
      save()

      // Les séries non validées suivent le nouveau poids courant.
      const entry = entryOf(ex.id)
      entry.sets.forEach((s) => {
        if (s.done || s.warmup) return
        if (ex.mode === 'reps') s.weight = ex.weight
        else s.seconds = ex.secMax
      })
      persist()
      close()
      refreshCard(ex.id)
      toast('Exercice mis à jour')
    })
    host.appendChild(wrap)
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]')
    if (!btn || !root.contains(btn)) return
    const act = btn.dataset.act
    const exId = btn.dataset.ex
    const ex = exId ? exOf(exId) : null
    const entry = exId ? entryOf(exId) : null
    const i = btn.dataset.i !== undefined ? Number(btn.dataset.i) : null

    switch (act) {
      case 'step': {
        stepValue(ex, entry.sets[i], btn.dataset.field, Number(btn.dataset.by))
        persist()
        refreshCard(exId)
        break
      }
      case 'ex-weight': {
        // Le poids courant de l'exo : toutes les séries pas encore validées suivent.
        const inc = Number(ex.increment) || 2.5
        ex.weight = Math.max(0, round(ex.weight + Number(btn.dataset.by) * inc))
        save()
        entry.sets.forEach((s) => {
          if (!s.done && !s.warmup) s.weight = ex.weight
        })
        persist()
        refreshCard(exId)
        break
      }
      case 'toggle':
        await validateSet(ex, entry, i)
        break
      case 'chrono':
        await runChrono(ex, entry, i)
        break
      case 'add-set':
        entry.sets.push({
          warmup: false,
          done: false,
          reps: ex.mode === 'reps' ? ex.repMax : null,
          weight: ex.mode === 'reps' ? ex.weight : 0,
          seconds: ex.mode === 'temps' ? ex.secMax : null
        })
        persist()
        refreshCard(exId)
        break
      case 'add-warmup': {
        const light = ex.mode === 'reps' ? Math.max(0, round(ex.weight * 0.6)) : 0
        entry.sets.unshift({
          warmup: true,
          done: false,
          reps: ex.mode === 'reps' ? ex.repMin : null,
          weight: light,
          seconds: ex.mode === 'temps' ? Math.round((ex.secMin || 60) / 2) : null
        })
        persist()
        refreshCard(exId)
        toast('Échauffement ajouté — exclu du moteur et des stats')
        break
      }
      case 'del-set':
        if (entry.sets.length <= 1) {
          toast('Il faut au moins une série')
          break
        }
        entry.sets.splice(i, 1)
        persist()
        refreshCard(exId)
        break
      case 'edit':
        openEditor(ex)
        break
      case 'finish': {
        const { done } = totals()
        if (done === 0) {
          toast('Aucune série validée')
          break
        }
        navigate(`#/seance/${sessionId}/resume`)
        break
      }
      case 'abandon': {
        const ok = await confirmDialog({
          title: 'Abandonner la séance ?',
          message: 'Les séries saisies seront perdues. Le programme, lui, ne bouge pas.',
          confirmLabel: 'Abandonner',
          danger: true
        })
        if (ok) {
          setLive(null)
          navigate('#/')
        }
        break
      }
    }
  }

  function onInput(e) {
    const input = e.target.closest('[data-input]')
    if (!input) return
    const ex = exOf(input.dataset.ex)
    const entry = entryOf(input.dataset.ex)
    const s = entry.sets[Number(input.dataset.i)]
    const raw = String(input.value).replace(',', '.')
    const v = parseFloat(raw)
    const field = input.dataset.input
    if (!Number.isFinite(v) || v < 0) {
      // saisie vide/invalide : on remet la valeur précédente
      input.value = field === 'weight' ? num(s.weight) : s[field] ?? ''
      return
    }
    s[field] = field === 'weight' ? round(v) : Math.round(v)
    persist()
    refreshCard(ex.id)
  }

  root.addEventListener('click', onClick)
  root.addEventListener('change', onInput)

  renderAll()

  return () => {
    clearInterval(chronoTimer)
    root.removeEventListener('click', onClick)
    root.removeEventListener('change', onInput)
  }
}
