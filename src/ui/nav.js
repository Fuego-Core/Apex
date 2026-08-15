/* NAVIGATION PRINCIPALE — cinq destinations, toujours visibles.

   La réponse permanente à « où suis-je ? » et « comment je change d'endroit ? ».
   Barre du bas sur mobile, barre latérale sur grand écran — le même élément,
   c'est le CSS qui décide de sa forme.

   Elle vit HORS de #app : les vues remplacent leur contenu à chaque rendu,
   la navigation, elle, ne clignote jamais.

   Elle s'efface pendant une séance : à ce moment-là, l'écran appartient à
   l'effort, pas à la navigation. */

import { logoMark } from '../ui.js'

/* Icônes : géométrie minimale, trait 1.8, héritent de la couleur du texte. */
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 11.2 L12 4.4 L20 11.2"/>
    <path d="M6.4 9.8 V19.6 H17.6 V9.8"/>
  </svg>`,
  training: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <path d="M7.2 12 H16.8"/>
    <path d="M6.4 7.8 V16.2 M17.6 7.8 V16.2"/>
    <path d="M3.4 9.8 V14.2 M20.6 9.8 V14.2"/>
  </svg>`,
  nutrition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4.2 C9.2 7.6 6.8 10.4 6.8 13.7 a5.2 5.2 0 0 0 10.4 0 c0-2.2-1.1-4.1-2.5-5.9"/>
    <path d="M12 20 c0-2.6 1-4.4 2.7-6.1"/>
  </svg>`,
  progress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 17.5 L9.5 12 L13.2 15.4 L20 8.2"/>
    <path d="M15.8 8 H20 V12.2"/>
  </svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <circle cx="12" cy="8.3" r="3.4"/>
    <path d="M5.4 19.6 a6.8 6.8 0 0 1 13.2 0"/>
  </svg>`
}

const TABS = [
  { id: 'home', label: 'Accueil', href: '#/', icon: ICONS.home },
  { id: 'training', label: 'Entraînement', href: '#/seances', icon: ICONS.training },
  { id: 'nutrition', label: 'Nutrition', href: '#/nutrition', icon: ICONS.nutrition },
  { id: 'progress', label: 'Progression', href: '#/progression', icon: ICONS.progress },
  { id: 'profile', label: 'Profil', href: '#/profil', icon: ICONS.profile }
]

/** Quel onglet possède ce chemin ? Chaque écran appartient à un seul endroit. */
export function tabFor(path) {
  if (path === '/' || path === '') return 'home'
  if (path.startsWith('/seance')) return 'training'
  if (path.startsWith('/nutrition') || path.startsWith('/recettes')) return 'nutrition'
  if (
    path.startsWith('/progression') ||
    path.startsWith('/corps') ||
    path.startsWith('/objectifs') ||
    path.startsWith('/historique') ||
    path.startsWith('/exercice')
  ) {
    return 'progress'
  }
  if (path.startsWith('/profil') || path.startsWith('/reglages')) return 'profile'
  return 'home'
}

/** La navigation disparaît pendant le flux de séance : préparation → effort → résumé. */
const hiddenOn = (path) => /^\/seance\//.test(path)

export function initNav() {
  if (document.getElementById('tabbar')) return

  const nav = document.createElement('nav')
  nav.id = 'tabbar'
  nav.className = 'tabbar'
  nav.setAttribute('aria-label', 'Navigation principale')
  nav.innerHTML = `
    <a class="tabbar__brand" href="#/" aria-label="APEX — accueil">
      ${logoMark(26)}
      <span class="tabbar__brandword">APEX</span>
    </a>
    ${TABS.map(
      (t) => `
      <a class="tabbar__item" data-tab="${t.id}" href="${t.href}">
        <span class="tabbar__icon">${t.icon}</span>
        <span class="tabbar__label">${t.label}</span>
      </a>`
    ).join('')}`
  document.body.appendChild(nav)
}

export function syncNav(path) {
  const nav = document.getElementById('tabbar')
  if (!nav) return

  const hidden = hiddenOn(path)
  nav.classList.toggle('is-hidden', hidden)
  document.body.classList.toggle('has-nav', !hidden)

  const active = tabFor(path)
  nav.querySelectorAll('[data-tab]').forEach((el) => {
    const on = el.dataset.tab === active
    el.classList.toggle('is-on', on)
    if (on) el.setAttribute('aria-current', 'page')
    else el.removeAttribute('aria-current')
  })
}
