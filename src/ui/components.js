/* Composants APEX — des fonctions qui rendent du HTML, pas un framework.

   Deux règles :
   - un composant ne connaît ni l'état ni le stockage, on lui passe tout ;
   - tout ce qui vient de l'utilisateur passe par esc().

   Les formulaires vivent dans une feuille du bas (`openSheet`) : c'est le seul
   motif de saisie de l'app, pouce en bas d'écran, clavier adapté au champ. */

import { esc, num } from '../ui.js'

/* ---------- affichage ---------- */

/** Tuile de mesure. `value` à null => état vide explicite, jamais un zéro. */
export function tile({ label, value, unit = '', hint = '', tone = '', empty = 'Aucune donnée' }) {
  const isEmpty = value === null || value === undefined || value === ''
  return `
    <div class="tile ${isEmpty ? 'tile--empty' : ''}">
      <p class="tile__label">${esc(label)}</p>
      <p class="tile__value">${
        isEmpty ? esc(empty) : `${esc(String(value))}${unit ? `<span class="tile__unit">${esc(unit)}</span>` : ''}`
      }</p>
      ${hint ? `<p class="tile__hint ${tone ? `tile__hint--${tone}` : ''}">${esc(hint)}</p>` : ''}
    </div>`
}

/** Barre d'avancement. `pct` à null => barre neutre : on ne sait pas. */
export function meter(pct, { done = false } = {}) {
  const width = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(100, pct))
  const variant = done ? 'meter__fill--done' : pct === null ? 'meter__fill--flat' : ''
  return `<div class="meter"><div class="meter__fill ${variant}" style="width:${width}%"></div></div>`
}

export function row({ href, title, meta = '', right = '' }) {
  const inner = `
    <div class="row__main">
      <p class="row__title">${esc(title)}</p>
      ${meta ? `<p class="row__meta">${esc(meta)}</p>` : ''}
    </div>
    ${right || '<span class="row__go">›</span>'}`
  return href ? `<a class="row" href="${esc(href)}">${inner}</a>` : `<div class="row">${inner}</div>`
}

/** État vide : dire ce qui manque, et proposer l'action qui le comble. */
export function blank({ title, text, actionLabel = null, act = null }) {
  return `
    <div class="card blank">
      <p class="blank__title">${esc(title)}</p>
      <p class="blank__text">${esc(text)}</p>
      ${actionLabel ? `<button class="btn btn--gold" data-act="${esc(act)}">${esc(actionLabel)}</button>` : ''}
    </div>`
}

export function sectionTitle(text, { href = null, linkLabel = 'Voir tout' } = {}) {
  return `
    <div class="section-head">
      <h3 class="section-title">${esc(text)}</h3>
      ${href ? `<a class="section-link" href="${esc(href)}">${esc(linkLabel)}</a>` : ''}
    </div>`
}

/* ---------- graphiques ---------- */

const W = 320
const H = 150
const PAD = { l: 6, r: 6, t: 10, b: 18 }

/**
 * Courbe d'une mesure : points bruts en gris, moyenne mobile en or.
 * @param {{date, value, average}[]} points
 */
export function plot(points, { unit = '', formatDate = (d) => d } = {}) {
  if (!points || points.length < 2) return ''

  const values = points.flatMap((p) => [p.value, p.average])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const x = (i) => PAD.l + (innerW * i) / (points.length - 1)
  const y = (v) => PAD.t + innerH - ((v - min) / span) * innerH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.average).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)} ${(
    PAD.t + innerH
  ).toFixed(1)} Z`
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2" class="plot__raw"/>`).join('')

  return `
    <svg class="plot" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Évolution : de ${esc(num(points[0].average))} à ${esc(num(points[points.length - 1].average))} ${esc(unit)}">
      <line x1="${PAD.l}" y1="${PAD.t + innerH}" x2="${W - PAD.r}" y2="${PAD.t + innerH}" class="plot__grid"/>
      <path d="${area}" class="plot__area"/>
      ${dots}
      <path d="${line}" class="plot__line"/>
      <text x="${PAD.l}" y="${H - 4}" class="plot__axis">${esc(formatDate(points[0].date))}</text>
      <text x="${W - PAD.r}" y="${H - 4}" text-anchor="end" class="plot__axis">${esc(
        formatDate(points[points.length - 1].date)
      )}</text>
    </svg>`
}

/** Courbe minuscule, sans axes : juste la forme du mouvement. */
export function sparkline(points) {
  if (!points || points.length < 2) return ''
  const vals = points.map((p) => p.average)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (100 * i) / (points.length - 1)
      const y = 34 - ((p.average - min) / span) * 30
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" class="plot__line" vector-effect="non-scaling-stroke"/>
  </svg>`
}

/* ---------- formulaires ---------- */

function fieldHTML(f, value) {
  const id = `f_${f.name}`
  const common = `id="${id}" name="${esc(f.name)}" class="fld__input"`
  let control

  if (f.type === 'select') {
    control = `<select ${common.replace('fld__input', 'fld__select')}>
      ${f.options
        .map(
          (o) =>
            `<option value="${esc(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${esc(
              o.label
            )}</option>`
        )
        .join('')}
    </select>`
  } else if (f.type === 'segmented') {
    control = `<div class="seg" data-seg="${esc(f.name)}">
      ${f.options
        .map(
          (o) =>
            `<button type="button" class="seg__opt ${String(o.value) === String(value ?? '') ? 'is-on' : ''}"
              data-seg-value="${esc(o.value)}">${esc(o.label)}</button>`
        )
        .join('')}
      <input type="hidden" name="${esc(f.name)}" value="${esc(value ?? '')}">
    </div>`
  } else if (f.type === 'number') {
    control = `<input ${common} type="text" inputmode="decimal" autocomplete="off"
      value="${esc(value ?? '')}" placeholder="${esc(f.placeholder ?? '')}">`
  } else if (f.type === 'date') {
    control = `<input ${common} type="date" value="${esc(value ?? '')}">`
  } else {
    control = `<input ${common} type="text" value="${esc(value ?? '')}" placeholder="${esc(f.placeholder ?? '')}">`
  }

  return `
    <div class="fld" data-field="${esc(f.name)}">
      <label class="fld__label" for="${id}">${esc(f.label)}</label>
      ${control}
      ${f.hint ? `<span class="fld__hint">${esc(f.hint)}</span>` : ''}
      <span class="fld__error" data-error-for="${esc(f.name)}" hidden></span>
    </div>`
}

/**
 * Feuille du bas contenant un formulaire.
 * @param {object} opts
 * @param {Function} [opts.validate] (values) => { champ: message } | null
 * @returns {Promise<object|null>} valeurs saisies, ou null si annulé.
 */
export function openSheet({ title, subtitle = '', fields, values = {}, submitLabel = 'Enregistrer', validate = null }) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'sheet'
    wrap.innerHTML = `
      <form class="sheet__panel" novalidate>
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">${esc(title)}</h3>
        ${subtitle ? `<p class="sheet__sub">${esc(subtitle)}</p>` : ''}
        ${fields.map((f) => fieldHTML(f, values[f.name])).join('')}
        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Annuler</button>
          <button type="submit" class="btn btn--gold">${esc(submitLabel)}</button>
        </div>
      </form>`

    const close = (result) => {
      wrap.classList.remove('is-in')
      setTimeout(() => wrap.remove(), 200)
      resolve(result)
    }

    // Sélecteurs segmentés : boutons + champ caché, pas de dépendance externe.
    wrap.querySelectorAll('[data-seg]').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-seg-value]')
        if (!opt) return
        seg.querySelectorAll('.seg__opt').forEach((b) => b.classList.remove('is-on'))
        opt.classList.add('is-on')
        seg.querySelector('input').value = opt.dataset.segValue
      })
    })

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-act="cancel"]')) close(null)
    })

    wrap.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const data = Object.fromEntries(new FormData(e.currentTarget).entries())

      wrap.querySelectorAll('[data-error-for]').forEach((el) => {
        el.hidden = true
        el.textContent = ''
      })
      wrap.querySelectorAll('.fld__input').forEach((el) => el.removeAttribute('aria-invalid'))

      const errors = validate ? validate(data) : null
      if (errors && Object.keys(errors).length) {
        for (const [name, message] of Object.entries(errors)) {
          const el = wrap.querySelector(`[data-error-for="${CSS.escape(name)}"]`)
          if (el) {
            el.textContent = message
            el.hidden = false
          }
          wrap.querySelector(`[name="${CSS.escape(name)}"]`)?.setAttribute('aria-invalid', 'true')
        }
        wrap.querySelector('[aria-invalid="true"]')?.focus()
        return
      }
      close(data)
    })

    host.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('is-in'))
    // Le premier champ prend le focus : une saisie = un geste de moins.
    wrap.querySelector('.fld__input')?.focus()
  })
}

/** Lecture d'un nombre saisi à la française (virgule acceptée). */
export function parseNumber(raw) {
  const v = parseFloat(String(raw ?? '').replace(',', '.'))
  return Number.isFinite(v) ? v : null
}
