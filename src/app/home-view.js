import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay } from './store.js'
import { esc, go, shell, top } from './ui.js'

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

export function homePage() {
  const day = nutritionDay(TODAY())
  const kcal = value(day.kcal)
  const protein = value(day.protein)
  const fat = value(day.fat)
  const carbs = value(day.carbs)
  const kcalLeft = Math.max(0, Math.round(nutritionTargets.kcal - kcal))
  const proteinLeft = Math.max(0, Math.round(nutritionTargets.protein - protein))

  shell(`
    ${top('Aujourd’hui', `${dateLabel()} · Ton suivi alimentaire`)}
    <section class="v3-nutrition-hero">
      <div class="v3-nutrition-main"><span>CONSOMMÉ</span><strong>${Math.round(kcal)}</strong><p>sur ${nutritionTargets.kcal} kcal</p></div>
      <div class="v3-nutrition-remaining"><span>IL TE RESTE</span><strong>${kcalLeft} kcal</strong><small>${proteinLeft} g de protéines</small></div>
      <div class="v3-calorie-track"><i style="width:${pct(kcal, nutritionTargets.kcal)}%"></i></div>
    </section>

    <section class="v3-macros">
      ${[['Protéines', protein, nutritionTargets.protein], ['Glucides', carbs, nutritionTargets.carbs], ['Lipides', fat, nutritionTargets.fat]].map(([label,current,target]) => `<article><div><span>${label}</span><strong>${Math.round(current)} <small>/ ${target} g</small></strong></div><div class="v3-macro-track"><i style="width:${pct(current,target)}%"></i></div></article>`).join('')}
    </section>

    <div class="v3-primary-actions">
      <button data-go="nutrition" class="v3-action-card"><span>AJOUTER</span><strong>Ce que je mange</strong><small>Scanner · favoris · saisie rapide</small><i>›</i></button>
      <button data-go="nutrition" class="v3-action-card"><span>MES REPÈRES</span><strong>${nutritionTargets.kcal} kcal · ${nutritionTargets.protein} g protéines</strong><small>${nutritionTargets.carbs} g glucides · ${nutritionTargets.fat} g lipides</small><i>›</i></button>
    </div>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>QUOI MANGER</span><h2>Ton rythme de journée</h2></div><small>Repères adaptés à ton rythme</small></div>
      <div class="v3-meal-timeline">
        ${mealPlan.map((meal) => `<article class="v3-meal open"><button class="v3-meal-head" type="button"><time>${esc(meal.time)}</time><span><strong>${esc(meal.title.replace(/^Repas \d+ · /, ''))}</strong><small>${esc(meal.target)}</small></span></button></article>`).join('')}
      </div>
    </section>
  `, 'home')

  document.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => go(button.dataset.go) })
}
