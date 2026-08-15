/* Petits utilitaires de rendu — pas de framework, juste des helpers. */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]))
}

/** 2.5 -> "2,5" ; 50 -> "50" (français, sans zéro inutile) */
export function num(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return String(v).replace('.', ',')
}

export function kg(n) {
  return `${num(n)} kg`
}

/** 90 -> "1:30" ; 900 -> "15:00" */
export function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Durée lisible : 3720 -> "1 h 02" ; 2700 -> "45 min" */
export function duration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`
  if (m > 0) return `${m} min`
  return `${s} s`
}

/** Repos affiché : 120 -> "2 min" ; 45 -> "45 s" ; 90 -> "1 min 30" */
export function restLabel(sec) {
  const s = Number(sec) || 0
  if (s === 0) return '—'
  if (s % 60 === 0) return `${s / 60} min`
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${s % 60}`
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(iso)} · ${hh}:${mm}`
}

/** "il y a 3 jours" / "aujourd'hui" */
export function relativeDays(iso) {
  if (!iso) return 'jamais fait'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'jamais fait'
  const today = new Date()
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((a - b) / 86400000)
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  if (days < 14) return 'il y a 1 semaine'
  return `il y a ${Math.floor(days / 7)} semaines`
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Message éphémère en bas d'écran (les messages s'empilent proprement). */
export function toast(message, tone = 'neutral') {
  const overlay = document.getElementById('overlay')
  let host = overlay.querySelector('.toast-stack')
  if (!host) {
    host = document.createElement('div')
    host.className = 'toast-stack'
    overlay.appendChild(host)
  }
  const el = document.createElement('div')
  el.className = `toast toast--${tone}`
  el.textContent = message
  host.appendChild(el)

  // Trois messages empilés suffisent : au-delà, ils masquent l'écran qu'ils
  // sont censés commenter. Les plus anciens partent en premier.
  const stacked = host.querySelectorAll('.toast')
  for (let i = 0; i < stacked.length - 3; i++) stacked[i].remove()
  requestAnimationFrame(() => el.classList.add('is-in'))
  setTimeout(() => {
    el.classList.remove('is-in')
    setTimeout(() => el.remove(), 250)
  }, 3200)
}

/** Confirmation plein écran (remplace window.confirm, moche sur mobile). */
export function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'modal'
    wrap.innerHTML = `
      <div class="modal__card">
        <h3 class="modal__title">${esc(title)}</h3>
        <p class="modal__text">${esc(message)}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-act="no">Annuler</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--gold'}" data-act="yes">${esc(confirmLabel)}</button>
        </div>
      </div>`
    const close = (v) => {
      wrap.remove()
      resolve(v)
    }
    wrap.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act
      if (act === 'yes') close(true)
      else if (act === 'no' || e.target === wrap) close(false)
    })
    host.appendChild(wrap)
  })
}

/** Bandeau persistant en haut d'écran : un problème que l'utilisateur doit voir
 *  et qui ne doit pas disparaître tout seul (échec d'enregistrement). */
export function banner(message, { tone = 'warn', id = 'default' } = {}) {
  const host = document.getElementById('overlay')
  const existing = host.querySelector(`.banner[data-banner="${id}"]`)
  if (existing) {
    existing.querySelector('.banner__text').textContent = message
    return
  }
  const el = document.createElement('div')
  el.className = `banner banner--${tone}`
  el.dataset.banner = id
  el.innerHTML = `
    <p class="banner__text"></p>
    <button class="banner__close" aria-label="Fermer">×</button>`
  el.querySelector('.banner__text').textContent = message
  el.querySelector('.banner__close').addEventListener('click', () => el.remove())
  host.appendChild(el)
  requestAnimationFrame(() => el.classList.add('is-in'))
}

/** Écran d'erreur bloquant : l'app ne peut pas démarrer. On explique, et on
 *  laisse toujours une porte de sortie pour récupérer ses données. */
export function fatalScreen(root, { title, message, details = [], onExport, onRetry }) {
  root.innerHTML = `
    <div class="page">
      <header class="brand">
        <span class="brand__mark">${logoMark(34)}</span>
        <span class="brand__word">APEX</span>
      </header>
      <section class="card fatal">
        <h2 class="fatal__title">${esc(title)}</h2>
        <p class="fatal__text">${esc(message)}</p>
        ${
          details.length
            ? `<ul class="fatal__details">${details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
            : ''
        }
        <p class="fatal__safe">Aucune donnée n’a été supprimée.</p>
        <div class="stack-sm">
          <button class="btn btn--gold btn--block" data-act="export">Exporter mes données</button>
          <button class="btn btn--ghost btn--block" data-act="retry">Réessayer</button>
        </div>
      </section>
    </div>`

  root.querySelector('[data-act="export"]').addEventListener('click', () => onExport?.())
  root.querySelector('[data-act="retry"]').addEventListener('click', () =>
    onRetry ? onRetry() : location.reload()
  )
}

/** Le symbole APEX — un sommet dans un sommet, la barre en pied.
 *  Inline et en currentColor : il hérite de l'or ou du gris selon le contexte,
 *  et reste net de 16 px à plein écran. */
export function logoMark(size = 28) {
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
    <path d="M24 4.5 L42.5 43 H36 L24 17.9 L12 43 H5.5 Z"/>
    <path d="M24 22.4 L28.2 31.2 H19.8 Z"/>
    <rect x="9" y="33.8" width="30" height="3.2"/>
    <rect x="5.4" y="30.9" width="2.7" height="9"/>
    <rect x="39.9" y="30.9" width="2.7" height="9"/>
  </svg>`
}


/** Entrer quelque part, plutôt que changer de page : un voile noir, un fil
 *  d'or, puis l'écran suivant. Respecte prefers-reduced-motion. */
export function transitionTo(hash) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    location.hash = hash
    return
  }
  const veil = document.createElement('div')
  veil.className = 'veil'
  document.getElementById('overlay').appendChild(veil)
  requestAnimationFrame(() => veil.classList.add('is-in'))
  setTimeout(() => {
    location.hash = hash
    setTimeout(() => {
      veil.classList.remove('is-in')
      setTimeout(() => veil.remove(), 260)
    }, 160)
  }, 240)
}

/** En-tête de page réutilisable.
 *  Sans `back`, c'est un écran de premier niveau : grand titre aligné à
 *  gauche, pas de flèche — la navigation principale est déjà là.
 *  Avec `back`, c'est un écran de détail : flèche + titre centré. */
export function header({ back = null, title, sub = '' }) {
  if (!back) {
    return `
      <header class="topbar topbar--top">
        <h1 class="topbar__big">${esc(title)}</h1>
        ${sub ? `<p class="topbar__bigsub">${esc(sub)}</p>` : ''}
      </header>`
  }
  return `
    <header class="topbar">
      <a class="topbar__back" href="${back}" aria-label="Retour">‹</a>
      <div class="topbar__titles">
        <h1 class="topbar__title">${esc(title)}</h1>
        ${sub ? `<p class="topbar__sub">${esc(sub)}</p>` : ''}
      </div>
      <span class="topbar__spacer"></span>
    </header>`
}
