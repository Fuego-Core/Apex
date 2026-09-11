export function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char])
}

export function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    : '—'
}

function icon(name) {
  const paths = {
    home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
    tracking: 'M5 19V9m7 10V5m7 14v-7',
    program: 'M5 7h4l2-3h2l2 3h4v12H5z M9 13h6',
    nutrition: 'M6 4h12v4H6z M8 8v12m8-12v12M6 20h12',
    progress: 'M4 18l5-6 4 3 7-9',
    checkin: 'm5 12 4 4 10-10'
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.home}"/></svg>`
}

function nav(active) {
  const activeGroup = active === 'workout'
    ? 'program'
    : ['progress', 'checkin', 'tracking'].includes(active) ? 'tracking' : active
  const items = [
    ['home', 'home', 'Accueil'],
    ['program', 'program', 'Entraînement'],
    ['nutrition', 'nutrition', 'Nutrition'],
    ['tracking', 'tracking', 'Suivi']
  ]

  return `<nav class="bottom-nav" aria-label="Navigation principale">${items.map(([route, glyph, label]) => `
    <button data-nav="${route}" class="nav-item ${activeGroup === route ? 'active' : ''}" aria-label="${label}">
      ${icon(glyph)}<span>${label}</span>
    </button>`).join('')}</nav>`
}

function announceRender(route) {
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent('apex:rendered', { detail: { route } }))
  })
}

export function shell(html, active) {
  document.body.dataset.route = active
  document.querySelector('#app').innerHTML = `
    <div class="app-shell">
      <main class="content">${html}</main>
      ${nav(active)}
    </div>`

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.onclick = () => go(button.dataset.nav)
  })
  announceRender(active)
}

export function top(title, subtitle = '') {
  return `<header class="page-head">
    <div class="app-brandbar">
      <div class="app-wordmark">APEX<em>.</em></div>
      <div class="app-brandtag">Coaching personnel</div>
    </div>
    <div class="page-title">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
  </header>`
}

export function section(title) {
  return `<div class="section-head"><h2>${title}</h2></div>`
}

export function coach(title, text) {
  return `<article class="coach-card">
    <div class="coach-mark">A</div>
    <div><strong>${title}</strong><p>${text}</p></div>
  </article>`
}

export function go(route) {
  const target = `#${route}`
  if (location.hash === target) return
  const navigate = () => { location.hash = route }
  if (document.startViewTransition) document.startViewTransition(navigate)
  else navigate()
}
