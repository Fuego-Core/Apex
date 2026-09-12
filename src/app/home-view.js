import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay } from './store.js'
import { esc, go, shell } from './ui.js'

function value(input) {
  const parsed = Number(String(input ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(current, target) {
  return target ? Math.max(0, Math.min(100, Math.round(value(current) / target * 100))) : 0
}

function dateLabel() {
  const label = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function icon(name) {
  const icons = {
    add: '＋', scan: '⌁', heart: '♡', stock: '□', meal: '☰'
  }
  return icons[name] || '•'
}

export function homePage() {
  const day = nutritionDay(TODAY())
  const kcal = value(day.kcal)
  const protein = value(day.protein)
  const fat = value(day.fat)
  const carbs = value(day.carbs)
  const kcalLeft = Math.max(0, Math.round(nutritionTargets.kcal - kcal))
  const proteinLeft = Math.max(0, Math.round(nutritionTargets.protein - protein))
  const caloriePct = pct(kcal, nutritionTargets.kcal)
  const macroRows = [
    ['Protéines', protein, nutritionTargets.protein, 'protein'],
    ['Glucides', carbs, nutritionTargets.carbs, 'carbs'],
    ['Lipides', fat, nutritionTargets.fat, 'fat']
  ]

  shell(`
    <header class="nx-head">
      <div class="nx-brand">APEX<span>.</span><small>NUTRITION</small></div>
      <div class="nx-date">${esc(dateLabel())}</div>
      <h1>Aujourd’hui</h1>
      <p>Ton suivi alimentaire, simplement.</p>
    </header>

    <section class="nx-calorie-card">
      <div class="nx-ring" style="--progress:${caloriePct * 3.6}deg"><div><strong>${caloriePct}%</strong><span>du quota</span></div></div>
      <div class="nx-calorie-copy">
        <span>CALORIES</span>
        <strong>${Math.round(kcal)} <small>/ ${nutritionTargets.kcal} kcal</small></strong>
        <p>${kcalLeft} kcal restantes aujourd’hui</p>
      </div>
      <div class="nx-remain"><span>IL TE RESTE</span><strong>${kcalLeft}</strong><small>kcal</small></div>
    </section>

    <section class="nx-macros">
      ${macroRows.map(([label,current,target,tone]) => `<article class="nx-macro nx-macro--${tone}">
        <div class="nx-macro-top"><span>${label}</span><b>${Math.round(current)} <small>/ ${target} g</small></b></div>
        <div class="nx-track"><i style="width:${pct(current,target)}%"></i></div>
        <small>${Math.max(0, Math.round(target-current))} g restantes</small>
      </article>`).join('')}
    </section>

    <button class="nx-add" data-go="nutrition">
      <span class="nx-add-icon">${icon('add')}</span>
      <span><strong>Ajouter un aliment</strong><small>Scanner · favoris · saisie rapide</small></span>
      <b>›</b>
    </button>

    <section class="nx-section">
      <div class="nx-section-head"><div><span>TES REPÈRES</span><h2>Repas du jour</h2></div><button data-go="nutrition">Voir tout</button></div>
      <div class="nx-meals">
        ${mealPlan.slice(0,4).map((meal, index) => `<button data-go="nutrition" class="nx-meal">
          <span>${esc(meal.time)}</span><strong>${esc(meal.title.replace(/^Repas \d+ · /, ''))}</strong><small>${esc(meal.target)}</small><b>＋</b>
        </button>`).join('')}
      </div>
    </section>

    <section class="nx-section">
      <div class="nx-section-head"><div><span>ACCÈS RAPIDE</span><h2>Alimentation</h2></div></div>
      <div class="nx-tools">
        <button data-go="nutrition"><i>${icon('scan')}</i><span><strong>Scanner un produit</strong><small>Code-barres ou saisie</small></span><b>›</b></button>
        <button data-go="nutrition"><i>${icon('heart')}</i><span><strong>Récents & favoris</strong><small>Ajouter en un geste</small></span><b>›</b></button>
        <button data-go="nutrition"><i>${icon('stock')}</i><span><strong>Mon stock</strong><small>Ce que tu as à la maison</small></span><b>›</b></button>
        <button data-go="nutrition"><i>${icon('meal')}</i><span><strong>Idées de repas</strong><small>Selon tes aliments</small></span><b>›</b></button>
      </div>
    </section>

    <section class="nx-tip"><span>OBJECTIF DU JOUR</span><strong>${proteinLeft > 0 ? `${proteinLeft} g de protéines à compléter` : 'Objectif protéines atteint'}</strong><p>Priorité au total de la journée, pas à la perfection repas par repas.</p></section>
  `, 'home')

  document.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => go(button.dataset.go) })
}
